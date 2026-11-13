import test from "node:test";
import assert from "node:assert/strict";
import { SupabaseStore } from "../server/supabase-store.js";
import { createApp } from "../server/app.js";
import { catalogue } from "../server/catalogue.js";
const env = {
  DATA_BACKEND: "supabase",
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_transport_only",
  SUPABASE_DB_SCHEMA: "glowlab",
};
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("backend rejects publishable, wrong-project, expired and anonymous credentials without network requests", () => {
  const jwt = (c) =>
    `header.${Buffer.from(JSON.stringify(c)).toString("base64url")}.signature`;
  for (const key of [
    "sb_publishable_test",
    jwt({ role: "anon" }),
    jwt({ role: "service_role", ref: "different" }),
    jwt({ role: "service_role", exp: 1 }),
  ])
    assert.throws(
      () => new SupabaseStore({ ...env, SUPABASE_SERVICE_ROLE_KEY: key }),
    );
  assert.throws(
    () =>
      new SupabaseStore({
        ...env,
        SUPABASE_URL: "http://test-project.supabase.co",
      }),
  );
});

test("actual Supabase SDK adapter uses the configured schema and catalogue mapping (mock HTTP transport, not live)", async () => {
  let count = 0;
  const store = new SupabaseStore(env, {
    fetch: async (url, options) => {
      count++;
      assert.equal(
        new Headers(options.headers).get("accept-profile"),
        "glowlab",
      );
      assert.equal(new URL(url).pathname, "/rest/v1/products");
      assert.ok(
        new URL(url).searchParams.get("select").includes("details_verified"),
      );
      assert.ok(options.signal instanceof AbortSignal);
      return response(catalogue);
    },
  });
  const records = await store.products();
  assert.equal(records.length, 12);
  assert.equal(count, 1);
  assert.deepEqual(
    records.map((p) => [p.id, p.price, p.image]),
    catalogue.map((p) => [p.id, p.price, p.image]),
  );
});

test("database faults are classified, bounded and sanitized; no network retry loop", async () => {
  const cases = [
    [
      () => {
        throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
      },
      "DATABASE_NETWORK",
    ],
    [
      () =>
        response(
          { code: "PGRST106", message: "private raw schema information" },
          406,
        ),
      "DATABASE_SCHEMA_NOT_EXPOSED",
    ],
    [
      () =>
        response(
          { code: "PGRST301", message: "private credential information" },
          401,
        ),
      "DATABASE_CREDENTIALS",
    ],
    [
      () => response({ code: "42501", message: "private SQL details" }, 403),
      "DATABASE_PERMISSIONS",
    ],
    [
      () => response({ code: "PGRST205", message: "private table names" }, 404),
      "DATABASE_SCHEMA_MISMATCH",
    ],
  ];
  for (const [transport, code] of cases) {
    let calls = 0;
    const store = new SupabaseStore(env, {
      fetch: (...args) => {
        calls++;
        return transport(...args);
      },
    });
    await assert.rejects(
      store.products(),
      (e) =>
        e.status === 503 && e.code === code && !e.message.includes("private"),
    );
    assert.equal(calls, 1);
  }
});

test("Supabase order lookup SDK request enforces owner, reference and email; RPC writes keep idempotency keys (mock transport)", async () => {
  const store = new SupabaseStore(env, {
    fetch: async (url, options) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/orders")) {
        assert.equal(u.searchParams.get("owner_hash"), "eq.owner-capability");
        assert.equal(u.searchParams.get("reference"), "eq.GL-TEST");
        assert.equal(
          u.searchParams.get("customer->>email"),
          "eq.demo@example.invalid",
        );
        return response(null);
      }
      const body = JSON.parse(options.body);
      assert.equal(body.p_owner, "owner-capability");
      assert.equal(body.p_key, "idempotency-key");
      assert.equal(
        new Headers(options.headers).get("content-profile"),
        "glowlab",
      );
      if (u.pathname.endsWith("/create_demo_order")) {
        assert.equal(body.p_fingerprint, "server-fingerprint");
        return response({ reference: "GL-TEST" });
      }
      assert.ok(u.pathname.endsWith("/create_customer_ticket"));
      return response({ id: "SUP-TEST" });
    },
  });
  assert.equal(
    await store.order("owner-capability", "gl-test", "DEMO@example.invalid"),
    null,
  );
  assert.equal(
    (
      await store.checkout(
        "owner-capability",
        { customer: {}, items: [], idempotencyKey: "idempotency-key" },
        "server-fingerprint",
      )
    ).reference,
    "GL-TEST",
  );
  assert.equal(
    (
      await store.ticket(
        "owner-capability",
        { name: "Demo" },
        "idempotency-key",
      )
    ).id,
    "SUP-TEST",
  );
});

async function withServer(store, fn) {
  const app = createApp({
    store,
    env,
    secret: "test-only-supabase-adapter-secret-long-enough",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

test("no configured database means no static catalogue fallback or false readiness", async () => {
  await withServer(undefined, async (base) => {
    for (const route of ["products", "ready", "products/cerave-foaming"]) {
      const res = await fetch(`${base}/api/${route}`);
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.code, "DATABASE_NOT_CONFIGURED");
      assert.ok(body.requestId);
      assert.equal(body.products, undefined);
    }
  });
});

test("readiness does a real adapter read; config is only configuration; product details are sourced from adapter", async () => {
  let reads = 0;
  await withServer(
    {
      products: async () => {
        reads++;
        return catalogue;
      },
    },
    async (base) => {
      const cfg = await fetch(base + "/api/config");
      assert.equal((await cfg.json()).storage, "supabase");
      assert.equal(reads, 0);
      const ready = await fetch(base + "/api/ready");
      assert.equal(ready.status, 200);
      assert.equal((await ready.json()).ready, true);
      assert.equal(reads, 1);
      const found = await fetch(base + "/api/products/cerave-foaming");
      assert.equal(found.status, 200);
      assert.equal((await found.json()).product.price, 14500);
      assert.equal((await fetch(base + "/api/products/missing")).status, 404);
    },
  );
});
