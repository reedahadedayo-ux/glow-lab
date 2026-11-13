import { GoogleGenAI } from "@google/genai";
import { AppError } from "./validation.js";
import { createGroqClient, ProviderFailure } from "./groq.js";
import { generateWithRecovery } from "./gemini-request.js";

export const geminiModel = (env = process.env) =>
  env.GEMINI_MODEL || "gemini-3.1-flash-lite";
export const LLM_REQUEST_BUDGET_MS = 90000;

// One router per assistant request. Once failed over, stay on Gemini for later rounds.
// Only generation is repeated: tool execution and UI delivery stay outside this layer.
export function createGenerationRouter({
  env,
  modelClient,
  groqClient,
  observeProvider,
  deadline,
}) {
  let fallback = false;
  const primary = groqClient || createGroqClient(env);
  const report = (provider, outcome, status = 0) => {
    const event = {
      event: "lumi_provider",
      provider,
      outcome,
      upstreamStatus: Number.isInteger(status) ? status : 0,
    };
    // Observability is allowlisted, never error.message, prompt, tool arguments or credentials.
    if (observeProvider) observeProvider(event);
    else console.info(JSON.stringify(event));
  };
  return async (input) => {
    if (!fallback) {
      try {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new ProviderFailure(0);
        const response = await primary.models.generateContent({
          ...input,
          config: {
            ...input.config,
            httpOptions: { timeout: Math.min(20000, remaining) },
          },
        });
        report("groq", "success");
        return response;
      } catch (error) {
        report("groq", "fallback", error.status);
        fallback = true;
      }
    }
    try {
      if (!env.GEMINI_API_KEY && !modelClient) throw new ProviderFailure(503);
      const ai = modelClient || new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const response = await generateWithRecovery(
        ai,
        { ...input, model: geminiModel(env) },
        deadline,
      );
      report("gemini", "success");
      return response;
    } catch (error) {
      report("gemini", "failure", error.status);
      const status = Number.isInteger(error.status) ? error.status : 0;
      const code =
        status === 429
          ? "GEMINI_RATE_LIMIT"
          : [401, 403].includes(status)
            ? "GEMINI_AUTH"
            : status === 404
              ? "GEMINI_MODEL"
              : status === 400
                ? "GEMINI_REQUEST"
                : "LLM_UNAVAILABLE";
      const failure = new AppError(
        status === 429 ? 429 : 503,
        "Lumi is busy or temporarily unavailable. Please try again shortly. You can still browse products, view your cart or use Contact. No action has been confirmed.",
        code,
      );
      failure.diagnostic = {
        event: "lumi_providers_unavailable",
        category: code,
        upstreamStatus: status,
      };
      throw failure;
    }
  };
}
