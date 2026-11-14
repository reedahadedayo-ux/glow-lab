// Synthetic, local-only benchmark. Does not load env files, contact providers,
// create Supabase records, send emails, or prove deployed latency.
import { performance } from "node:perf_hooks";
import { LocalStore } from "../server/local-store.js";
import { respond } from "../server/lumi.js";
import { verifyOrder } from "../server/order-lookup.js";
import { signer } from "../server/security.js";
const store = new LocalStore(":memory:");
const order = await store.checkout(
  "benchmark",
  {
    customer: {
      name: "Benchmark Demo",
      email: "demo@example.invalid",
      phone: "+2348000000000",
      address: "12 Fictional Street",
      city: "Jos",
      instructions: "",
    },
    items: [{ productId: "cerave-foaming", quantity: 1 }],
    idempotencyKey: crypto.randomUUID(),
  },
  "synthetic-fingerprint",
);
const samples = { productQuestionMs: [], directLookupMs: [], lumiLookupMs: [] };
const sizes = [];
let generations = 0;
const measure = async (key, operation) => {
  const start = performance.now();
  await operation();
  samples[key].push(Number((performance.now() - start).toFixed(2)));
};
const ask = async (name, args) => {
  let round = 0;
  return respond({
    store,
    owner: "fresh-browser",
    env: {},
    signer: signer("benchmark-only-not-a-live-secret"),
    message: "Synthetic benchmark request",
    observeProvider() {},
    modelClient: {
      models: {
        async generateContent(input) {
          generations++;
          sizes.push(JSON.stringify(input).length);
          await new Promise((resolve) => setTimeout(resolve, 80));
          if (++round === 1) return { functionCalls: [{ name, args }] };
          return { text: "Synthetic explanation of verified data." };
        },
      },
    },
  });
};
try {
  for (let i = 0; i < 5; i++) {
    await measure("productQuestionMs", () =>
      ask("search_products", { query: "cleanser" }),
    );
    await measure("directLookupMs", () =>
      verifyOrder(store, {
        reference: order.reference,
        email: " DEMO@EXAMPLE.INVALID ",
      }),
    );
    await measure("lumiLookupMs", () =>
      ask("lookup_order", {
        reference: order.reference,
        email: "demo@example.invalid",
      }),
    );
  }
  const summary = Object.fromEntries(
    Object.entries(samples).map(([name, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [
        name,
        {
          samples: values,
          median: sorted[Math.floor(sorted.length / 2)],
          maximum: sorted.at(-1),
        },
      ];
    }),
  );
  console.log(
    JSON.stringify(
      {
        kind: "LOCAL_SYNTHETIC_NOT_PRODUCTION_LATENCY",
        syntheticProviderDelayPerRoundMs: 80,
        summary,
        generations,
        inputBytes: {
          minimum: Math.min(...sizes),
          maximum: Math.max(...sizes),
        },
        note: "SQLite in memory; mocked generation. No external HTTP/DB latency measured. Direct lookup uses zero LLM calls; a successful tool-backed explanation uses two.",
      },
      null,
      2,
    ),
  );
} finally {
  store.db.close();
}
