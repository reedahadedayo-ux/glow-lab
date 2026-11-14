import { withDeadline } from "./request-deadline.js";
import { systemInstruction } from "./lumi-system-prompt.js";
export { systemInstruction } from "./lumi-system-prompt.js";
import { declarations, executeTool } from "./tools.js";
import { AppError } from "./validation.js";
import { redactSecrets } from "./secret-safety.js";
import { createGenerationRouter, LLM_REQUEST_BUDGET_MS } from "./llm-router.js";
export { geminiModel } from "./llm-router.js";

const stable = (v) =>
  JSON.stringify(
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, JSON.parse(stable(v[k]))]),
        )
      : Array.isArray(v)
        ? v.map((x) => JSON.parse(stable(x)))
        : v,
  );

export async function respond(options) {
  try {
    return await withDeadline(
      () => respondWithinBudget(options),
      LLM_REQUEST_BUDGET_MS,
    );
  } catch (error) {
    if (error.name === "TimeoutError")
      throw new AppError(
        504,
        "Lumi took too long to respond. Please retry or use the order lookup on Contact. No action has been confirmed.",
        "LLM_TIMEOUT",
      );
    throw error;
  }
}

async function respondWithinBudget({
  message,
  historyToken,
  store,
  owner,
  signer,
  env = process.env,
  modelClient,
  observeTool,
  groqClient,
  observeProvider,
  lookupOrder,
}) {
  if (!env.GROQ_API_KEY && !groqClient && !env.GEMINI_API_KEY && !modelClient)
    throw new AppError(
      503,
      "Lumi is not connected to an AI provider yet. You can still browse, shop and use Contact. No AI response has been generated.",
    );
  let contents = [];
  if (historyToken) {
    const data = signer.open(historyToken);
    if (data.kind !== "history" || data.owner !== owner)
      throw new AppError(
        403,
        "Conversation belongs to a different browser session.",
      );
    contents = data.contents;
  }
  contents.push({ role: "user", parts: [{ text: message }] });
  // Collapse repeated reads within one message, not across customers or checkouts.
  const requestStore = Object.create(store);
  for (const method of ["products", "policies"]) {
    let cached;
    requestStore[method] = () => (cached ||= store[method]());
  }
  const products = new Map();
  let routine = null;
  let ticket = null;
  let order = null;
  let providerUsed = null;
  let fallbackUsed = false;
  const toolFailures = [];
  const deadline = Date.now() + LLM_REQUEST_BUDGET_MS;
  const generate = createGenerationRouter({
    env,
    modelClient,
    groqClient,
    observeProvider: (event) => {
      if (event.outcome === "success") providerUsed = event.provider;
      if (event.outcome === "fallback") fallbackUsed = true;
      if (observeProvider) observeProvider(event);
      else console.info(JSON.stringify(event));
    },
    deadline,
  });
  const completedTools = new Map();
  for (let step = 0; step < 6; step++) {
    const response = await generate({
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: declarations }],
        temperature: 0.2,
        maxOutputTokens: 1400,
      },
    });
    const calls = response.functionCalls;
    if (!calls?.length) {
      const text = redactSecrets(response.text?.trim(), env);
      if (!text)
        throw new AppError(
          502,
          "Lumi returned an empty response. Please try again.",
          "LLM_EMPTY_RESPONSE",
        );
      contents.push({ role: "model", parts: [{ text }] });
      // Keep whole user/model/tool turns together. Server-signed history cannot be forged by clients.
      while (contents.length > 24 || JSON.stringify(contents).length > 24000) {
        let next = contents.findIndex(
          (c, i) => i > 0 && c.role === "user" && c.parts?.some((p) => p.text),
        );
        if (next < 1) break;
        contents = contents.slice(next);
      }
      return {
        text,
        products: [...products.values()],
        routine,
        ticket,
        order,
        provider: providerUsed,
        fallbackUsed,
        toolFailures,
        historyToken: signer.seal({
          kind: "history",
          owner,
          contents: redactSecrets(contents, env),
          expires: Date.now() + 2 * 60 * 60 * 1000,
        }),
      };
    }
    if (calls.length > 5)
      throw new AppError(
        502,
        "Lumi requested too many actions. Please narrow your question.",
      );
    contents.push(
      response.candidates?.[0]?.content || {
        role: "model",
        parts: calls.map((c) => ({ functionCall: c })),
      },
    );
    const results = [];
    for (const call of calls) {
      const cacheKey = `${call.name}:${stable(call.args || {})}`;
      const cached = completedTools.has(cacheKey);
      let result = completedTools.get(cacheKey);
      if (!cached) {
        const started = Date.now();
        try {
          result = await withDeadline(
            () =>
              executeTool(call.name, call.args || {}, {
                store: requestStore,
                owner,
                signer,
                lookupOrder,
              }),
            Math.min(10000, deadline - Date.now()),
          );
          if (call.name === "lookup_order") order = { ...result };
          if (observeTool)
            observeTool({
              name: call.name,
              durationMs: Date.now() - started,
              success: !result.error,
              productIds: (result.products || []).map((p) => p.id),
            });
        } catch (e) {
          if (observeTool)
            observeTool({
              name: call.name,
              durationMs: Date.now() - started,
              success: false,
              productIds: [],
            });
          // A failed verification/database operation must never become a guessed
          // natural-language success. Preserve classified, sanitized API errors.
          if (call.name === "lookup_order") throw e;
          toolFailures.push({
            name: call.name,
            code: e instanceof AppError ? e.code : "TOOL_FAILED",
          });
          result = {
            code: e instanceof AppError ? e.code : "TOOL_FAILED",
            error:
              e instanceof AppError
                ? e.message
                : "The requested operation failed. No success is confirmed.",
          };
        }
        completedTools.set(cacheKey, result);
      }
      result = redactSecrets(result, env);
      for (const p of result.products || []) products.set(p.id, p);
      if (result.routine) routine = result.routine;
      if (result.confirmation_required) {
        ticket = { draft: result.draft, token: result.token };
        result = {
          confirmation_required: true,
          draft: result.draft,
          note: result.note,
        };
      }
      results.push({
        functionResponse: { name: call.name, id: call.id, response: result },
      });
    }
    contents.push({ role: "user", parts: results });
  }
  throw new AppError(
    502,
    "Lumi could not finish this request. Please ask a simpler question.",
    "LLM_STEP_LIMIT",
  );
}
