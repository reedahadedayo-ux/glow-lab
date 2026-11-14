import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { LocalStore } from "../server/local-store.js";
import { createApp } from "../server/app.js";
import { signer } from "../server/security.js";
import { executeTool } from "../server/tools.js";
import { respond } from "../server/lumi.js";
const secret = "test-only-secret-with-more-than-32-characters";
const customer = {
  name: "Demo Customer",
  email: "demo@example.com",
  phone: "+234 800 000 0000",
  address: "12 Demo Street",
  city: "Jos",
  instructions: "",
};
const draft = () => ({
  customer,
  items: [{ productId: "cerave-foaming", quantity: 2 }],
  idempotencyKey: randomUUID(),
});
async function withAPI(fn, options = {}) {
  const store = new LocalStore(":memory:");
  const app = createApp({
    store,
    secret,
    env: { DATA_BACKEND: "local" },
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const request = async (path, body, extra = {}) => {
    const r = await fetch(url + "/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        cookie,
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json(), headers: r.headers };
  };
  try {
    await request("config");
    await fn({ request, store, url, getCookie: () => cookie });
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    store.db.close();
  }
}
test("catalogue uses existing prices, images and no unverified ingredients", () =>
  withAPI(async ({ request }) => {
    const r = await request("products");
    assert.equal(r.body.products.length, 12);
    assert.equal(
      r.body.products.find((p) => p.id === "cerave-foaming").price,
      14500,
    );
    assert.deepEqual(r.body.products[0].ingredients, []);
  }));
test("checkout persists snapshots, authoritative totals and simulated paid status; duplicate retries are safe", () =>
  withAPI(async ({ request, store }) => {
    const input = draft();
    const first = await request("checkout", input);
    assert.equal(first.status, 201);
    const o = first.body.order;
    assert.equal(o.total, 29000);
    assert.equal(o.payment_status, "paid");
    assert.equal(o.payment_method, "simulated");
    assert.equal(o.order_status, "confirmed");
    assert.equal(o.fulfillment_status, "unfulfilled");
    assert.equal(o.subtotal, 29000);
    assert.equal(o.shipping_fee, 0);
    assert.equal(o.customer_name, customer.name);
    assert.equal(o.items[0].unit_price, 14500);
    const second = await request("checkout", input);
    assert.equal(second.body.order.reference, o.reference);
    assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 1);
    const conflict = await request("checkout", {
      ...input,
      items: [{ productId: "cerave-foaming", quantity: 1 }],
    });
    assert.equal(conflict.status, 409);
  }));
test("checkout rejects client prices, payment status, malformed delivery, duplicate IDs, missing IDs, negative/fractional quantities", () =>
  withAPI(async ({ request }) => {
    for (const input of [
      { ...draft(), total: 1 },
      { ...draft(), paymentStatus: "paid" },
      { ...draft(), customer: { ...customer, email: "bad" } },
      { ...draft(), items: [{ productId: "cerave-foaming", quantity: -1 }] },
      { ...draft(), items: [{ productId: "cerave-foaming", quantity: 1.1 }] },
      {
        ...draft(),
        items: [
          { productId: "cerave-foaming", quantity: 1 },
          { productId: "cerave-foaming", quantity: 1 },
        ],
      },
    ])
      assert.equal((await request("checkout", input)).status, 400);
    assert.equal(
      (
        await request("checkout", {
          ...draft(),
          items: [{ productId: "invented", quantity: 1 }],
        })
      ).status,
      409,
    );
  }));
test("lookup verifies reference and email across browser sessions; failures are generic", () =>
  withAPI(async ({ request, url }) => {
    const {
      body: { order },
    } = await request("checkout", draft());
    assert.equal(
      (
        await request("orders/lookup", {
          reference: order.reference,
          email: customer.email,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("orders/lookup", {
          reference: order.reference,
          email: "wrong@example.com",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request("orders/lookup", {
          reference: "GL-UNKNOWN",
          email: customer.email,
        })
      ).status,
      404,
    );
    const stranger = await fetch(url + "/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: order.reference,
        email: customer.email,
      }),
    });
    assert.equal(stranger.status, 200);
    const summary = (await stranger.json()).order;
    assert.equal(summary.customer, undefined);
    assert.equal(summary.customer_email, undefined);
  }));
test("full confirmation preserves owner-bound item receipt; fresh session only gets limited lookup", () =>
  withAPI(async ({ request }) => {
    const created = await request("checkout", draft());
    const input = {
      reference: created.body.order.reference,
      email: customer.email,
    };
    const receipt = await request("orders/confirmation", input);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.body.order.items[0].product_id, "cerave-foaming");
    const fresh = await request("orders/confirmation", input, { cookie: "" });
    assert.equal(fresh.status, 404);
    assert.equal(fresh.body.order, undefined);
    const limited = await request("orders/lookup", input, { cookie: "" });
    assert.equal(limited.status, 200);
    assert.equal(limited.body.order.items, undefined);
    assert.equal(limited.body.order.customer, undefined);
  }));
test("support persists and is idempotent; cannot associate another browser order", () =>
  withAPI(async ({ request, url, store }) => {
    const {
      body: { order },
    } = await request("checkout", draft());
    const data = {
      name: customer.name,
      email: customer.email,
      issue: "My demo order arrived damaged.",
      orderReference: order.reference,
      priority: "normal",
      idempotencyKey: randomUUID(),
    };
    const first = await request("support", data);
    assert.equal(first.status, 201);
    assert.match(first.body.ticket.id, /^SUP-/);
    assert.equal(
      (await request("support", data)).body.ticket.id,
      first.body.ticket.id,
    );
    assert.equal(store.db.prepare("SELECT count(*) n FROM tickets").get().n, 1);
    const stranger = await fetch(url + "/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    assert.equal(stranger.status, 404);
  }));
test("CSRF rejects foreign origins; sensitive files and automation are not served", () =>
  withAPI(async ({ request, url }) => {
    assert.equal(
      (await request("checkout", draft(), { Origin: "https://evil.example" }))
        .status,
      403,
    );
    for (const path of [
      "/.env",
      "/server/app.js",
      "/data/catalogue-original.json",
      "/package.json",
      "/.git/config",
      "/automation.html",
    ])
      assert.equal((await fetch(url + path)).status, 404);
  }));
test("disk persistence survives reopening database", async () => {
  const dir = mkdtempSync(tmpdir() + "/glowlab-");
  let store = new LocalStore(dir + "/demo.sqlite");
  const input = draft();
  const order = await store.checkout("owner", input, "fingerprint");
  const ticket = await store.ticket(
    "owner",
    {
      name: customer.name,
      email: customer.email,
      issue: "A genuine persisted demo issue.",
      orderReference: order.reference,
    },
    randomUUID(),
  );
  store.db.close();
  store = new LocalStore(dir + "/demo.sqlite");
  assert.equal(
    (await store.order("owner", order.reference, customer.email)).reference,
    order.reference,
  );
  assert.equal(
    store.db.prepare("SELECT count(*) n FROM tickets WHERE id=?").get(ticket.id)
      .n,
    1,
  );
  store.db.close();
  rmSync(dir, { recursive: true });
});
test("stock is decremented atomically and insufficient inventory does not create an order", async () => {
  const store = new LocalStore(":memory:");
  const p = (await store.products())[0];
  p.stock = 1;
  store.db
    .prepare("UPDATE products SET data=? WHERE id=?")
    .run(JSON.stringify(p), p.id);
  await assert.rejects(store.checkout("owner", draft(), "fp"), /insufficient/);
  assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 0);
  await store.checkout(
    "owner",
    { ...draft(), items: [{ productId: p.id, quantity: 1 }] },
    "fp",
  );
  assert.equal((await store.products())[0].stock, 0);
  store.db.close();
});
test("all five tools return real data; support draft requires explicit confirmation before persistence", async () => {
  const store = new LocalStore(":memory:");
  const sign = signer(secret);
  const ctx = { store, owner: "owner", signer: sign };
  const found = await executeTool(
    "search_products",
    { query: "cleanser" },
    ctx,
  );
  assert.equal(found.products.length, 2);
  const routine = await executeTool(
    "build_skincare_routine",
    { skinType: "Oily", budget: 50000 },
    ctx,
  );
  assert.equal(routine.products.length, 3);
  assert.ok(routine.routine.total <= 50000);
  assert.ok(
    routine.products.every(
      (p) =>
        found.products.find((x) => x.id === p.id) || p.category !== "Cleansers",
    ),
  );
  assert.ok(
    (await executeTool("get_store_policy", { topic: "delivery" }, ctx)).policies
      .length,
  );
  assert.deepEqual(
    (await executeTool("get_store_policy", { topic: "imaginary" }, ctx))
      .policies,
    [],
  );
  const draft = await executeTool(
    "create_support_ticket",
    {
      name: customer.name,
      email: customer.email,
      issue: "Please record a damaged demo item.",
    },
    ctx,
  );
  assert.equal(draft.confirmation_required, true);
  assert.equal(store.db.prepare("SELECT count(*) n FROM tickets").get().n, 0);
  assert.equal(sign.open(draft.token).owner, "owner");
  await assert.rejects(
    executeTool(
      "lookup_order",
      { reference: "GL-UNKNOWN", email: customer.email },
      ctx,
    ),
    (error) => error.code === "ORDER_NOT_VERIFIED",
  );
  store.db.close();
});
test("Gemini orchestration executes model-requested function and returns result to model (mocked SDK transport)", async () => {
  const store = new LocalStore(":memory:");
  let calls = 0;
  const modelClient = {
    models: {
      async generateContent(input) {
        calls++;
        if (calls === 1) {
          assert.ok(
            input.config.tools[0].functionDeclarations.some(
              (d) => d.name === "build_skincare_routine",
            ),
          );
          return {
            functionCalls: [
              {
                name: "search_products",
                args: { query: "cleanser" },
                id: "call-1",
              },
            ],
          };
        }
        const part = input.contents.at(-1).parts[0];
        assert.equal(part.functionResponse.name, "search_products");
        assert.equal(part.functionResponse.response.products.length, 2);
        return { text: "Here are the catalogue cleansers." };
      },
    },
  };
  const result = await respond({
    message: "Find a cleanser",
    store,
    owner: "owner",
    signer: signer(secret),
    env: {},
    modelClient,
  });
  assert.equal(calls, 2);
  assert.equal(result.products.length, 2);
  assert.ok(result.historyToken);
  store.db.close();
});
test("history tampering/cross-session replay, missing key, rate limit and empty Gemini responses fail honestly", async () => {
  const store = new LocalStore(":memory:");
  const sign = signer(secret);
  const base = {
    message: "hello",
    store,
    owner: "owner",
    signer: sign,
    env: {},
  };
  await assert.rejects(respond(base), /not connected/);
  await assert.rejects(
    respond({ ...base, historyToken: "forged", modelClient: {} }),
    /Invalid/,
  );
  const token = sign.seal({
    kind: "history",
    owner: "someone-else",
    contents: [],
    expires: Date.now() + 10000,
  });
  await assert.rejects(
    respond({ ...base, historyToken: token, modelClient: {} }),
    /different browser/,
  );
  await assert.rejects(
    respond({
      ...base,
      modelClient: {
        models: {
          async generateContent() {
            throw { status: 429 };
          },
        },
      },
    }),
    /busy/,
  );
  await assert.rejects(
    respond({
      ...base,
      modelClient: {
        models: {
          async generateContent() {
            return { text: "" };
          },
        },
      },
    }),
    /empty/,
  );
  store.db.close();
});
test("support confirmation is owner-bound and saves exactly one ticket on repeated approvals", () =>
  withAPI(async ({ request, getCookie, store }) => {
    const sign = signer(secret);
    const cookie = getCookie().split("=")[1];
    const token = sign.seal({
      kind: "support",
      owner: sign.owner(cookie),
      draft: {
        name: customer.name,
        email: customer.email,
        issue: "Please save this confirmed issue.",
        priority: "normal",
        orderReference: "",
      },
      key: randomUUID(),
      expires: Date.now() + 10000,
    });
    const a = await request("support/confirm", { token });
    const b = await request("support/confirm", { token });
    assert.equal(a.status, 201);
    assert.equal(a.body.ticket.id, b.body.ticket.id);
    assert.equal(store.db.prepare("SELECT count(*) n FROM tickets").get().n, 1);
  }));
test("unconfigured database cannot falsely confirm persistence", () =>
  withAPI(
    async ({ request }) => {
      assert.equal((await request("checkout", draft())).status, 503);
      assert.equal((await request("config")).body.storage, "unconfigured");
    },
    { store: undefined },
  ));

test("simultaneous duplicate checkout requests create one order", () =>
  withAPI(async ({ request, store }) => {
    const input = draft();
    const responses = await Promise.all([
      request("checkout", input),
      request("checkout", input),
    ]);
    assert.ok(responses.every((r) => r.status === 201));
    assert.equal(
      responses[0].body.order.reference,
      responses[1].body.order.reference,
    );
    assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 1);
  }));

test("HTTPS reverse-proxy origin on the same host is accepted; cross-site and non-JSON requests are rejected", () =>
  withAPI(async ({ request, url }) => {
    const origin = url.replace("http:", "https:");
    assert.equal(
      (await request("checkout", draft(), { Origin: origin })).status,
      201,
    );
    assert.equal(
      (await request("checkout", draft(), { "Sec-Fetch-Site": "cross-site" }))
        .status,
      403,
    );
    const response = await fetch(url + "/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });
    assert.equal(response.status, 415);
  }));
