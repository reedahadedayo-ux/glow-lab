// Opt-in, server-only verification. NO mocks, fallback catalogue, keys or raw errors in logs.
import { GoogleGenAI } from "@google/genai";
import { readFileSync, readdirSync } from "node:fs";
import { createApp } from "../server/app.js";
import { SupabaseStore } from "../server/supabase-store.js";
import { geminiModel } from "../server/lumi.js";
import { redactSecrets } from "../server/secret-safety.js";

export async function verifyLiveGemini(env = process.env) {
  const report = {
    kind: "LIVE_GEMINI_SUPABASE_NO_MOCKS",
    model: geminiModel(env),
    sdk: "@google/genai",
    checkedAt: new Date().toISOString(),
    checks: [],
  };
  const check = async (name, fn) => {
    try {
      const evidence = await fn();
      report.checks.push({ name, status: "passed", ...evidence });
      return true;
    } catch (error) {
      report.checks.push({
        name,
        status: "failed",
        code:
          error.code ||
          (error.status === 404
            ? "GEMINI_MODEL_NOT_FOUND"
            : error.status === 429
              ? "GEMINI_RATE_LIMIT"
              : [401, 403].includes(error.status)
                ? "GEMINI_AUTH"
                : "VERIFICATION_FAILED"),
        upstreamStatus:
          error.diagnostic?.upstreamStatus ||
          (Number.isInteger(error.status) ? error.status : 0),
      });
      return false;
    }
  };
  const demand = (condition, code) => {
    if (!condition)
      throw Object.assign(new Error("Verification failed"), { code });
  };
  demand(env.VERCEL_ENV === "preview", "PREVIEW_ONLY_VERIFICATION");
  if (!env.GEMINI_API_KEY) {
    report.checks.push({
      name: "server_environment",
      status: "failed",
      code: "GEMINI_KEY_MISSING",
    });
    return report;
  }
  const leakFree = (value) =>
    !JSON.stringify(value).includes(env.GEMINI_API_KEY);
  const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(`${directory}/${e.name}`)
        : [`${directory}/${e.name}`],
    );
  await check("public_output_secret_scan", async () => {
    const files = walk("public");
    for (const file of files) {
      const body = readFileSync(file);
      demand(
        !body.includes(Buffer.from(env.GEMINI_API_KEY)),
        "PUBLIC_SECRET_LEAK",
      );
    }
    return { fileCount: files.length, noKeyInPublicOutput: true };
  });
  const directOK = await check("actual_gemini_sdk_request", async () => {
    const ai = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: { timeout: 25000 },
    });
    let response;
    try {
      response = await ai.models.generateContent({
        model: geminiModel(env),
        contents: "Reply only: GlowLab live connection verified.",
        config: { maxOutputTokens: 512, temperature: 0 },
      });
    } catch (error) {
      if (error.status === 404) {
        try {
          const models = await ai.models.list({ config: { pageSize: 100 } });
          const names = [];
          for await (const model of models) {
            if (
              model.name &&
              /^models\/gemini[\w.-]+$/.test(model.name) &&
              model.supportedActions?.includes("generateContent")
            )
              names.push(model.name);
          }
          report.availableGenerativeModels = names;
        } catch {
          report.modelDiscovery = "failed";
        }
      }
      throw error;
    }
    demand(!!response.text?.trim(), "GEMINI_EMPTY_RESPONSE");
    demand(leakFree(response.text), "MODEL_SECRET_LEAK");
    return { nonemptyModelResponse: true };
  });
  let store;
  const catalogueOK = await check("actual_supabase_catalogue", async () => {
    demand(env.DATA_BACKEND === "supabase", "SUPABASE_REQUIRED");
    store = new SupabaseStore(env);
    const products = await store.products();
    const original = JSON.parse(
      readFileSync(
        new URL("../data/catalogue-original.json", import.meta.url),
        "utf8",
      ),
    );
    const tuples = (items) =>
      JSON.stringify(items.map((p) => [p.id, Number(p.price), p.image]).sort());
    demand(
      tuples(products) === tuples(original),
      "CATALOGUE_PRESERVATION_MISMATCH",
    );
    demand(leakFree(products), "CATALOGUE_SECRET_LEAK");
    return {
      productCount: products.length,
      originalIdsPricesImagesMatch: true,
    };
  });
  if (!directOK || !catalogueOK) {
    report.checks.push({
      name: "real_lumi_search_and_routine",
      status: "blocked",
      code: "UPSTREAM_PREREQUISITE_FAILED",
    });
    return report;
  }
  let trace = [];
  let reads = 0;
  const readProducts = store.products.bind(store);
  store.products = async () => {
    reads++;
    return readProducts();
  };
  // Read-only verification must never save orders or tickets.
  store.checkout = store.ticket = async () => {
    throw Object.assign(new Error("Read-only verification"), {
      code: "UNEXPECTED_MUTATION",
    });
  };
  const app = createApp({
    store,
    env,
    secret: env.SESSION_SECRET,
    observeTool: (event) => trace.push(event),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const request = async (path, body) => {
    const response = await fetch(`${base}/api/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        cookie,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(165000),
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const data = await response.json();
    demand(leakFree(data), "API_SECRET_LEAK");
    if (!response.ok)
      throw Object.assign(new Error("API failed"), {
        code: data.code || "HTTP_ERROR",
        status: response.status,
      });
    return data;
  };
  try {
    await check("server_configuration_api", async () => {
      const data = await request("config");
      demand(
        data.gemini === true && data.storage === "supabase",
        "RUNTIME_ENVIRONMENT_MISMATCH",
      );
      return { geminiConfigured: true, secretValueNotReturned: true };
    });
    await check("real_lumi_product_search_http", async () => {
      trace = [];
      const initialReads = reads;
      const data = await request("lumi", {
        message:
          "Find CeraVe Foaming Facial Cleanser in the current GlowLab catalogue and show its current NGN price. Use search_products now; no routine or medical advice is needed.",
      });
      demand(
        trace.some((t) => t.name === "search_products" && t.success),
        "MODEL_DID_NOT_SEARCH",
      );
      demand(reads > initialReads, "CATALOGUE_NOT_READ");
      const item = data.products?.find((p) => p.id === "cerave-foaming");
      demand(item?.price === 14500, "SEARCH_RESULT_MISMATCH");
      demand(!!data.text?.trim(), "LUMI_EMPTY_RESPONSE");
      return {
        modelRequestedTools: trace.map((t) => ({
          name: t.name,
          success: t.success,
        })),
        realCatalogueReads: reads - initialReads,
        verifiedProductId: item.id,
        verifiedPrice: item.price,
      };
    });
    await check("real_lumi_routine_http", async () => {
      trace = [];
      const initialReads = reads;
      const data = await request("lumi", {
        message:
          "Build a basic morning and evening shopping routine for oily skin. My total product budget is 50000 NGN, I prefer just cleanser, moisturizer and sunscreen, and have no ingredient exclusions to check. Use build_skincare_routine with skinType Oily and budget 50000 now. Show the catalogue products for my review, but do not add anything to a cart.",
      });
      demand(
        trace.some((t) => t.name === "build_skincare_routine" && t.success),
        "MODEL_DID_NOT_BUILD_ROUTINE",
      );
      demand(reads > initialReads, "CATALOGUE_NOT_READ");
      demand(data.routine?.morning?.length > 0, "ROUTINE_MISSING");
      const actual = await readProducts();
      for (const p of data.products || [])
        demand(
          actual.some(
            (a) =>
              a.id === p.id &&
              Number(a.price) === p.price &&
              a.image === p.image,
          ),
          "ROUTINE_PRODUCT_MISMATCH",
        );
      const sum = (data.products || []).reduce((s, p) => s + p.price, 0);
      demand(
        sum === data.routine.total && sum <= 50000,
        "ROUTINE_BUDGET_MISMATCH",
      );
      return {
        modelRequestedTools: trace.map((t) => ({
          name: t.name,
          success: t.success,
        })),
        realCatalogueReads: reads - initialReads,
        routineTotal: data.routine.total,
        productIds: data.products.map((p) => p.id),
        cartMutation: false,
      };
    });
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  return report;
}

export async function logLiveVerification(env = process.env) {
  let report;
  try {
    report = await verifyLiveGemini(env);
  } catch {
    report = {
      kind: "LIVE_GEMINI_SUPABASE_NO_MOCKS",
      checks: [
        { name: "verification_setup", status: "failed", code: "SETUP_FAILED" },
      ],
    };
  }
  report.passed =
    report.checks.length > 0 &&
    report.checks.every((c) => c.status === "passed");
  // Never print upstream error.message, stacks, request headers, tokens, model text or env.
  console.log(
    "GLOWLAB_LIVE_VERIFICATION " + JSON.stringify(redactSecrets(report, env)),
  );
  if (!report.passed) process.exitCode = 1;
  return report;
}
if (process.argv[1] === new URL(import.meta.url).pathname)
  await logLiveVerification();
