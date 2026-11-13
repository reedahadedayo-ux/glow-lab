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

// Actual revised responder + official SDK + actual deployed catalogue; no fallback records.
export async function probeLumiRecovery() {
  const { respond } = await import("../server/lumi.js");
  const { signer } = await import("../server/security.js");
  const { randomBytes } = await import("node:crypto");
  const session = signer(randomBytes(32).toString("hex"));
  let historyToken;
  let reads = 0;
  const store = {
    products: async () => {
      reads++;
      const response = await fetch(
        "https://glow-lab-puce.vercel.app/api/products",
        { signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) throw new Error("Catalogue unavailable");
      const data = await response.json();
      if (data.backend !== "supabase" || data.products?.length !== 12)
        throw new Error("Catalogue verification failed");
      return data.products;
    },
  };
  const checks = [];
  for (const message of [
    "Hello Lumi",
    "Find CeraVe Foaming Facial Cleanser in the catalogue and tell me the price.",
  ]) {
    const start = Date.now();
    const tools = [];
    try {
      const response = await respond({
        message,
        historyToken,
        store,
        owner: "read-only-diagnostic",
        signer: session,
        env: { ...process.env, GEMINI_MODEL: "gemini-3.5-flash" },
        observeTool: (event) => tools.push(event),
      });
      historyToken = response.historyToken;
      checks.push({
        ok: true,
        elapsedMs: Date.now() - start,
        hasText: Boolean(response.text),
        products: response.products.map((p) => ({ id: p.id, price: p.price })),
        tools,
      });
    } catch (error) {
      checks.push({
        ok: false,
        elapsedMs: Date.now() - start,
        code: error.code || "PROBE_FAILED",
        upstreamStatus: error.diagnostic?.upstreamStatus || 0,
        tools,
      });
    }
    console.log("GLOWLAB_LUMI_RECOVERY_CHECK " + JSON.stringify(checks.at(-1)));
  }
  const passed =
    checks.every((c) => c.ok && c.hasText) &&
    checks[1].products?.some(
      (p) => p.id === "cerave-foaming" && p.price === 14500,
    ) &&
    reads > 0;
  console.log(
    "GLOWLAB_LUMI_RECOVERY " + JSON.stringify({ passed, reads, checks }),
  );
  if (!passed)
    throw new Error(
      "Actual Lumi recovery verification failed; not safe to promote",
    );
}
