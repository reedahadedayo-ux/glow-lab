// Opt-in preview-build probe. No database writes, mail, customer data or raw model text.
import { randomBytes } from "node:crypto";
import { respond } from "../server/lumi.js";
import { signer } from "../server/security.js";
import { createApp } from "../server/app.js";
import { groqModel } from "../server/groq.js";
import { geminiModel } from "../server/llm-router.js";

export async function verifyLiveProviders() {
  const env = process.env;
  const events = [];
  const checks = [];
  const context = {
    env,
    owner: "read-only-provider-probe",
    signer: signer(randomBytes(32).toString("hex")),
    store: {
      async products() {
        const response = await fetch(
          "https://glow-lab-puce.vercel.app/api/products",
          { signal: AbortSignal.timeout(10000) },
        );
        if (!response.ok) throw new Error("Catalogue unavailable");
        const result = await response.json();
        if (result.backend !== "supabase" || result.products?.length !== 12)
          throw new Error("Catalogue read failed");
        return result.products;
      },
      // No write/ticket/order capabilities are provided to this probe.
    },
    observeProvider: (event) => events.push(event),
  };
  const fail = {
    models: {
      async generateContent() {
        throw Object.assign(new Error("Injected outage"), { status: 503 });
      },
    },
  };
  for (const [name, options] of [
    ["groq_live", {}],
    ["groq_live_tool", {}],
    ["groq_injected_failure_gemini_live", { groqClient: fail }],
    ["both_injected_unavailable", { groqClient: fail, modelClient: fail }],
  ]) {
    events.length = 0;
    const tools = [];
    try {
      const result = await respond({
        ...context,
        ...options,
        message:
          name === "groq_live_tool"
            ? "Look up CeraVe Foaming Facial Cleanser with search_products and tell me its exact catalogue price in NGN."
            : "Hello Lumi. In one short sentence, introduce yourself.",
        observeTool: (event) =>
          tools.push({ name: event.name, success: event.success }),
      });
      checks.push({
        name,
        ok: !!result.text && !!result.historyToken,
        events: [...events],
        tools,
        hasText: !!result.text,
        correctProduct: result.products.some(
          (p) => p.id === "cerave-foaming" && p.price === 14500,
        ),
      });
    } catch (error) {
      checks.push({
        name,
        ok: false,
        code: error.code || "PROBE_FAILED",
        upstreamStatus: error.diagnostic?.upstreamStatus || 0,
        events: [...events],
        tools,
      });
    }
    console.log("GLOWLAB_PROVIDER_CHECK " + JSON.stringify(checks.at(-1)));
  }
  // Same HTTP route consumed by Lumi frontend; local HTTP on Vercel build host, real Groq.
  events.length = 0;
  const app = createApp({
    env: { ...env, VERCEL: "" },
    secret: randomBytes(32).toString("hex"),
    store: context.store,
    observeProvider: context.observeProvider,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/lumi`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Hello Lumi. Please introduce yourself briefly.",
        }),
        signal: AbortSignal.timeout(100000),
      },
    );
    const body = await response.json();
    checks.push({
      name: "live_provider_http_contract",
      status: response.status,
      ok:
        response.ok &&
        !!body.text &&
        !!body.historyToken &&
        Array.isArray(body.products),
      events: [...events],
    });
    console.log("GLOWLAB_PROVIDER_CHECK " + JSON.stringify(checks.at(-1)));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    "GLOWLAB_PROVIDER_REPORT " +
      JSON.stringify({
        groqModel: groqModel(env),
        geminiModel: geminiModel(env),
        checks,
      }),
  );
}
