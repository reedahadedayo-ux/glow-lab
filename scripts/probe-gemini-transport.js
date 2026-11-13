// Preview-only read-only SDK diagnostic. Never emits raw errors, prompts, or credentials.
import { GoogleGenAI } from "@google/genai";
import { systemInstruction } from "../server/lumi-system-prompt.js";
import { declarations } from "../server/tools.js";
export async function probeGeminiTransport() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 60000 },
  });
  const checks = [];
  for (const full of [false, true]) {
    const start = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Hello Lumi",
        config: {
          maxOutputTokens: 1400,
          temperature: 0.2,
          ...(full
            ? {
                systemInstruction,
                tools: [{ functionDeclarations: declarations }],
              }
            : {}),
        },
      });
      checks.push({
        fullPrompt: full,
        ok: true,
        elapsedMs: Date.now() - start,
        hasText: Boolean(response.text),
        toolCalls: response.functionCalls?.length || 0,
      });
    } catch (error) {
      const description = String(error.message || "").toLowerCase();
      checks.push({
        fullPrompt: full,
        ok: false,
        elapsedMs: Date.now() - start,
        status: Number.isInteger(error.status) ? error.status : 0,
        timeout: /timeout|timed out|abort/.test(description),
        network: /fetch|network|socket|connect/.test(description),
        unavailable: /unavailable|overload/.test(description),
      });
    }
  }
  console.log("GLOWLAB_GEMINI_TRANSPORT " + JSON.stringify(checks));
}
