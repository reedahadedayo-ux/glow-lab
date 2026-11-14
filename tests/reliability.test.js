import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { LocalStore } from "../server/local-store.js";
import { SupabaseStore } from "../server/supabase-store.js";
import { createApp } from "../server/app.js";
import { verifyOrder, createLookupGuard } from "../server/order-lookup.js";
import { respond } from "../server/lumi.js";
import { signer } from "../server/security.js";
import { AppError, checkoutSchema, parse } from "../server/validation.js";
import { withDeadline } from "../server/request-deadline.js";
import { createGenerationRouter } from "../server/llm-router.js";

const secret = "reliability-test-only-not-a-live-session-secret";
const customer = {
  name: "Reliability Demo",
  email: "demo@example.invalid",
  phone: "+2348000000000",
  address: "12 Fictional Street",
  city: "Jos",
  instructions: "",
};
const draft = () => ({
  customer: { ...customer },
  items: [{ productId: "cerave-foaming", quantity: 1 }],
  idempotencyKey: randomUUID(),
});
async function fixture(fn) {
  const store = new LocalStore(":memory:");
  try {
    const order = await store.checkout("original", draft(), "test-fingerprint");
    await fn(store, order);
  } finally {
    store.db.close();
  }
}
async function httpFixture(store, fn, extra = {}) {
  const app = createApp({
    store,
    secret,
    env: {},
    observeProvider() {},
    ...extra,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const post = async (path, data) => {
    // Intentionally no cookies: every request starts a fresh browser capability.
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return { status: response.status, body: await response.json() };
  };
  try {
    await fn(post);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
const base = (store) => ({
  store,
  env: {},
  owner: "fresh-owner",
  signer: signer(secret),
  observeProvider() {},
});
const toolModel = (name, args, inspect = () => {}) => {
  let rounds = 0;
  return {
    models: {
      async generateContent(input) {
        if (++rounds === 1)
          return { functionCalls: [{ name, args, id: "test-call" }] };
        inspect(input.contents.at(-1).parts[0].functionResponse.response);
        return { text: "Test explanation of verified tool data." };
      },
    },
  };
};

test("lookup normalizes reference/email, works from a fresh session and returns no contact data or IDs", () =>
  fixture(async (store, order) => {
    await httpFixture(store, async (post) => {
      const result = await post("orders/lookup", {
        reference: ` ${order.reference.toLowerCase()} `,
        email: " DEMO@EXAMPLE.INVALID ",
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.order.reference, order.reference);
      assert.equal(result.body.order.total, 14500);
      for (const key of [
        "customer",
        "customer_email",
        "customer_phone",
        "delivery_address",
        "owner_hash",
        "id",
        "items",
      ])
        assert.equal(result.body.order[key], undefined);
      assert.equal(
        await store.order("fresh-owner", order.reference, customer.email),
        null,
        "owner-bound adapter is not weakened",
      );
    });
  }));

test("wrong email and nonexistent reference have identical public status/code/message", () =>
  fixture(async (store, order) => {
    await httpFixture(store, async (post) => {
      const wrong = await post("orders/lookup", {
        reference: order.reference,
        email: "wrong@example.invalid",
      });
      const missing = await post("orders/lookup", {
        reference: "GL-NONEXISTENT",
        email: customer.email,
      });
      assert.equal(wrong.status, 404);
      assert.equal(missing.status, 404);
      assert.equal(wrong.body.code, "ORDER_NOT_VERIFIED");
      assert.equal(wrong.body.error, missing.body.error);
      assert.equal(wrong.body.code, missing.body.code);
    });
  }));

test("invalid input rejects partial/wildcard references, missing email, extra order data before DB access", async () => {
  let reads = 0;
  const store = {
    async verifiedOrder() {
      reads++;
    },
  };
  for (const input of [
    { reference: "GL-%", email: customer.email },
    { reference: "", email: customer.email },
    { reference: "GL-ABCD" },
    { reference: "GL-ABCD", email: "invalid" },
    { reference: "GL-ABCD", email: customer.email, total: 1 },
  ]) {
    await assert.rejects(
      verifyOrder(store, input),
      (e) => e.status === 400 && e.code === "ORDER_LOOKUP_INVALID",
    );
  }
  assert.equal(reads, 0);
});

test("checkout trims and lowercases email before persistence", () =>
  fixture(async (store) => {
    const input = draft();
    input.customer.email = " DEMO@EXAMPLE.INVALID ";
    const parsed = parse(checkoutSchema, input);
    const saved = await store.checkout("email-owner", parsed, "fingerprint");
    assert.equal(saved.customer.email, customer.email);
    assert.ok(
      await verifyOrder(store, {
        reference: saved.reference,
        email: customer.email,
      }),
    );
  }));

test("database unavailable and lookup timeout are explicit non-successes, with no raw error", async () => {
  const input = { reference: "GL-ABCD", email: customer.email };
  await httpFixture(
    {
      async verifiedOrder() {
        throw new Error("private database details");
      },
    },
    async (post) => {
      const result = await post("orders/lookup", input);
      assert.equal(result.status, 503);
      assert.equal(result.body.code, "DATABASE_UNAVAILABLE");
      assert.doesNotMatch(JSON.stringify(result.body), /private database/);
    },
  );
  await assert.rejects(
    verifyOrder({ verifiedOrder: () => new Promise(() => {}) }, input, {
      timeoutMs: 20,
    }),
    (e) => e.status === 504 && e.code === "ORDER_LOOKUP_TIMEOUT",
  );
});

test("lookup limiter has a fixed window and fresh cookies cannot bypass the direct/tool shared allowance", async () => {
  let time = 0;
  const guard = createLookupGuard({ limit: 1, now: () => time });
  guard("ip");
  assert.throws(
    () => guard("ip"),
    (e) => e.code === "ORDER_LOOKUP_LIMIT",
  );
  time = 60001;
  guard("ip");
  let reads = 0;
  const args = { reference: "GL-ABCD", email: customer.email };
  await httpFixture(
    {
      async verifiedOrder() {
        reads++;
        return null;
      },
    },
    async (post) => {
      for (let i = 0; i < 10; i++)
        assert.equal((await post("orders/lookup", args)).status, 404);
      const result = await post("lumi", { message: "Check my order" });
      assert.equal(result.status, 429);
      assert.equal(result.body.code, "ORDER_LOOKUP_LIMIT");
      assert.equal(reads, 10);
    },
    { modelClient: toolModel("lookup_order", args) },
  );
});

test("Supabase verified lookup uses actual schema fields, exact reference/email filters and narrow projection (mock transport)", async () => {
  let reads = 0;
  const store = new SupabaseStore(
    {
      SUPABASE_URL: "https://test-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-secret",
    },
    {
      fetch: async (url) => {
        reads++;
        const query = new URL(url).searchParams;
        assert.equal(query.get("reference"), "eq.GL-ABCD");
        assert.equal(query.get("customer->>email"), "eq.demo@example.invalid");
        assert.equal(query.has("owner_hash"), false);
        assert.doesNotMatch(
          query.get("select"),
          /customer|address|owner|items|\bid\b/,
        );
        return Response.json({
          reference: "GL-ABCD",
          order_status: "confirmed",
          total: 14500,
        });
      },
    },
  );
  const result = await verifyOrder(store, {
    reference: "gl-abcd",
    email: " DEMO@EXAMPLE.INVALID ",
  });
  assert.equal(reads, 1);
  assert.equal(result.reference, "GL-ABCD");
});

test("Lumi receives only verified order data from a fresh owner and exposes structured verification", () =>
  fixture(async (store, order) => {
    const result = await respond({
      ...base(store),
      message: "Where is my order?",
      modelClient: toolModel(
        "lookup_order",
        { reference: order.reference, email: customer.email },
        (data) => {
          assert.equal(data.reference, order.reference);
          assert.equal(data.order_status, "confirmed");
          assert.equal(data.customer, undefined);
          assert.equal(data.customer_email, undefined);
        },
      ),
    });
    assert.equal(result.order.reference, order.reference);
    assert.equal(result.provider, "gemini");
    assert.equal(result.fallbackUsed, true);
  }));

test("failed order verification stops before an LLM can pretend lookup succeeded", async () => {
  let calls = 0;
  await assert.rejects(
    respond({
      ...base({ verifiedOrder: async () => null }),
      message: "Check order",
      modelClient: {
        models: {
          async generateContent() {
            calls++;
            if (calls > 1) return { text: "Order delivered!" };
            return {
              functionCalls: [
                {
                  name: "lookup_order",
                  args: { reference: "GL-ABCD", email: customer.email },
                },
              ],
            };
          },
        },
      },
    }),
    (e) => e.code === "ORDER_NOT_VERIFIED",
  );
  assert.equal(calls, 1);
});

for (const [label, name, args] of [
  ["normal product question", "search_products", { query: "cleanser" }],
  [
    "personalised recommendation",
    "build_skincare_routine",
    { skinType: "Oily", budget: 50000 },
  ],
  ["policy question", "get_store_policy", { topic: "delivery" }],
])
  test(`Lumi ${label} uses actual local catalogue/policy tools (mock LLM)`, () =>
    fixture(async (store) => {
      const result = await respond({
        ...base(store),
        message: label,
        modelClient: toolModel(name, args, (data) => {
          assert.equal(data.error, undefined);
          if (name === "get_store_policy") assert.ok(data.policies.length);
          else assert.ok(data.products.every((p) => p.id && p.price > 0));
        }),
      });
      assert.ok(result.historyToken);
      assert.equal(result.toolFailures.length, 0);
    }));

test("distinct catalogue tools share one request-scoped database read", () =>
  fixture(async (store) => {
    let reads = 0,
      rounds = 0;
    const original = store.products.bind(store);
    store.products = () => {
      reads++;
      return original();
    };
    const result = await respond({
      ...base(store),
      message: "Find a cleanser and routine",
      modelClient: {
        models: {
          async generateContent() {
            if (++rounds === 1)
              return {
                functionCalls: [
                  { name: "search_products", args: { query: "cleanser" } },
                  {
                    name: "build_skincare_routine",
                    args: { skinType: "Oily" },
                  },
                ],
              };
            return { text: "Catalogue results." };
          },
        },
      },
    });
    assert.equal(reads, 1);
    assert.ok(result.products.length);
  }));

test(
  "hanging primary is bounded, then fallback succeeds without duplicate generation delivery",
  { timeout: 12000 },
  async () => {
    const events = [];
    let aborted = false;
    const generate = createGenerationRouter({
      env: {},
      deadline: Date.now() + 11000,
      groqClient: {
        models: {
          generateContent(input) {
            input.config.abortSignal.addEventListener("abort", () => {
              aborted = true;
            });
            return new Promise(() => {});
          },
        },
      },
      modelClient: {
        models: { generateContent: async () => ({ text: "Recovered" }) },
      },
      observeProvider: (e) => events.push(e),
    });
    const started = performance.now();
    const result = await generate({ config: {} });
    assert.equal(result.text, "Recovered");
    assert.equal(aborted, true);
    assert.ok(performance.now() - started < 11000);
    assert.deepEqual(
      events.map((e) => [e.provider, e.outcome]),
      [
        ["groq", "fallback"],
        ["gemini", "success"],
      ],
    );
    assert.ok(events.every((e) => typeof e.durationMs === "number"));
  },
);

test("both unavailable and slow/interrupted operations fail with sanitized, distinct errors", async () => {
  const generate = createGenerationRouter({
    env: {},
    deadline: Date.now() + 1000,
    groqClient: {
      models: {
        generateContent: async () => {
          throw { status: 503 };
        },
      },
    },
    modelClient: {
      models: {
        generateContent: async () => {
          throw { status: 401 };
        },
      },
    },
    observeProvider() {},
  });
  await assert.rejects(
    generate({ config: {} }),
    (e) => e instanceof AppError && e.code === "GEMINI_AUTH",
  );
  const started = performance.now();
  await assert.rejects(
    withDeadline(() => new Promise(() => {}), 20),
    { name: "TimeoutError" },
  );
  assert.ok(performance.now() - started < 1000);
  await assert.rejects(
    withDeadline(
      () =>
        Promise.reject(
          Object.assign(new Error("interrupted"), { name: "AbortError" }),
        ),
      100,
    ),
    { name: "AbortError" },
  );
});

test("assistant/API exact legacy policies match demo reality without invented delivery or email denial", async () => {
  const { publicPolicy } = await import("../server/policy-copy.js");
  const store = new LocalStore(":memory:");
  try {
    const original = (await store.policies()).find(
      (p) => p.slug === "delivery",
    );
    const projected = publicPolicy(original);
    assert.match(projected.content, /Make workflow/);
    assert.doesNotMatch(
      projected.content,
      /1–3|3–7|No courier tracking, SMS or email/,
    );
    assert.equal(
      publicPolicy({ ...original, content: "Owner custom policy" }).content,
      "Owner custom policy",
    );
    assert.notEqual(original.content, projected.content);
  } finally {
    store.db.close();
  }
});
