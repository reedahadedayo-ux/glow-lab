import { GoogleGenAI } from "@google/genai";
import { systemInstruction } from "./lumi-system-prompt.js";
export { systemInstruction } from "./lumi-system-prompt.js";
import { declarations, executeTool } from "./tools.js";
import { AppError } from "./validation.js";
import { redactSecrets } from "./secret-safety.js";
import {
  generateWithRecovery,
  GEMINI_REQUEST_BUDGET_MS,
} from "./gemini-request.js";
export const geminiModel = (env = process.env) =>
  env.GEMINI_MODEL || "gemini-2.5-flash";

export async function respond({
  message,
  historyToken,
  store,
  owner,
  signer,
  env = process.env,
  modelClient,
  observeTool,
}) {
  if (!env.GEMINI_API_KEY && !modelClient)
    throw new AppError(
      503,
      "Lumi is not connected to Gemini yet. You can still browse, shop and use Contact. No AI response has been generated.",
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
  const ai =
    modelClient ||
    new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: { timeout: 25000 },
    });
  const products = new Map();
  let routine = null;
  let ticket = null;
  const deadline = Date.now() + GEMINI_REQUEST_BUDGET_MS;
  for (let step = 0; step < 6; step++) {
    let response;
    try {
      response = await generateWithRecovery(
        ai,
        {
          model: geminiModel(env),
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: declarations }],
            temperature: 0.2,
            maxOutputTokens: 1400,
          },
        },
        deadline,
      );
    } catch (e) {
      const status = Number.isInteger(e.status) ? e.status : 0;
      const code =
        status === 429
          ? "GEMINI_RATE_LIMIT"
          : [401, 403].includes(status)
            ? "GEMINI_AUTH"
            : status === 404
              ? "GEMINI_MODEL"
              : status === 400
                ? "GEMINI_REQUEST"
                : "GEMINI_UNAVAILABLE";
      const failure = new AppError(
        status === 429 ? 429 : 503,
        status === 429
          ? "Lumi is busy. Please wait a moment before retrying."
          : "Lumi could not reach Gemini. Please try again. No action has been confirmed.",
        code,
      );
      failure.diagnostic = {
        event: "gemini_request_failed",
        category: code,
        upstreamStatus: status,
      };
      throw failure;
    }
    const calls = response.functionCalls;
    if (!calls?.length) {
      const text = redactSecrets(response.text?.trim(), env);
      if (!text)
        throw new AppError(
          502,
          "Lumi returned an empty response. Please try again.",
        );
      contents.push({ role: "model", parts: [{ text }] });
      // Keep whole user/model/tool turns together. Server-signed history cannot be forged by clients.
      while (contents.length > 24 || JSON.stringify(contents).length > 48000) {
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
      let result;
      try {
        result = await executeTool(call.name, call.args || {}, {
          store,
          owner,
          signer,
        });
      } catch (e) {
        result = {
          error:
            e instanceof AppError
              ? e.message
              : "The requested operation failed. No success is confirmed.",
        };
      }
      if (observeTool)
        observeTool({
          name: call.name,
          success: !result.error,
          productIds: (result.products || []).map((p) => p.id),
        });
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
  );
}
