// Opt-in REAL Supabase HTTP integration. No local adapter, SQL connector or mock fallback.
// Run on a host that can reach Supabase; creates clearly fictional demo records.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/app.js";
import { SupabaseStore } from "../server/supabase-store.js";
if (!process.argv.includes("--allow-demo-writes"))
  throw new Error(
    "Pass --allow-demo-writes to authorize real demo order/ticket writes.",
  );
const env = process.env;
if (
  env.DATA_BACKEND !== "supabase" ||
  !env.SUPABASE_URL ||
  !env.SUPABASE_SERVICE_ROLE_KEY ||
  !env.SESSION_SECRET
)
  throw new Error(
    "Configure Supabase mode, server credentials and a stable SESSION_SECRET.",
  );
mkdirSync(".data", { recursive: true });
const app = createApp({
  store: new SupabaseStore(env),
  env,
  secret: env.SESSION_SECRET,
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
let state;
try {
  state = JSON.parse(readFileSync(".data/live-http-state.json", "utf8"));
} catch {
  state = {
    project: env.SUPABASE_URL,
    orderKey: randomUUID(),
    ticketKey: randomUUID(),
  };
}
if (state.project !== env.SUPABASE_URL)
  throw new Error(
    "Saved live test state belongs to another project; review it before testing a different database.",
  );
const save = () =>
  writeFileSync(".data/live-http-state.json", JSON.stringify(state), {
    mode: 0o600,
  });
async function request(path, body, cookie = state.cookie) {
  const r = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    signal: AbortSignal.timeout(15000),
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body
        ? { "Content-Type": "application/json", Origin: env.APP_ORIGIN || base }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!state.cookie && r.headers.get("set-cookie")) {
    state.cookie = r.headers.get("set-cookie").split(";")[0];
    save();
  }
  return { status: r.status, body: await r.json() };
}
const report = {
  kind: "actual website HTTP routes with real Supabase adapter",
  project: env.SUPABASE_URL,
  started_at: new Date().toISOString(),
  checks: [],
};
try {
  const config = await request("config");
  assert.equal(config.body.storage, "supabase");
  const catalogue = await request("products");
  if (catalogue.status !== 200)
    report.databaseFailure = {
      status: catalogue.status,
      code: catalogue.body.code,
      requestId: catalogue.body.requestId,
    };
  assert.equal(
    catalogue.status,
    200,
    "Real Supabase catalogue could not be fetched; no checkout has been attempted.",
  );
  assert.equal(catalogue.body.source, "database");
  assert.equal(catalogue.body.backend, "supabase");
  const original = JSON.parse(
    readFileSync(
      new URL("../data/catalogue-original.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    catalogue.body.products.map((p) => [p.id, p.price, p.image]).sort(),
    original.map((p) => [p.id, p.price, p.image]).sort(),
    "Live catalogue must preserve every original ID, price and image reference",
  );
  const detail = await request("products/" + catalogue.body.products[0].id);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.product.id, catalogue.body.products[0].id);
  assert.equal((await request("ready")).body.ready, true);
  assert.ok(catalogue.body.products.length > 0);
  report.checks.push("real Supabase catalogue through HTTP route");
  const p = catalogue.body.products.find((p) => p.available);
  assert.ok(p, "No demo product available for live HTTP test.");
  state.productId ??= p.id;
  save();
  const product = catalogue.body.products.find((p) => p.id === state.productId);
  assert.ok(product?.available);
  const input = {
    customer: {
      name: "GlowLab HTTP Integration Test",
      email: "http-demo@example.invalid",
      phone: "+2348000000000",
      address: "56 Fictional HTTP Demo Street",
      city: "Jos",
      instructions: "Automated live HTTP test; do not fulfill.",
    },
    items: [{ productId: state.productId, quantity: 1 }],
    idempotencyKey: state.orderKey,
  };
  const first = await request("checkout", input);
  assert.equal(first.status, 201);
  const o = first.body.order;
  state.reference = o.reference;
  save();
  assert.equal(Number(o.subtotal), product.price);
  assert.equal(Number(o.shipping_fee), 0);
  assert.equal(Number(o.total), product.price);
  assert.equal(o.payment_status, "paid");
  assert.equal(o.payment_method, "simulated");
  assert.equal(o.order_status, "confirmed");
  assert.equal(o.fulfillment_status, "unfulfilled");
  assert.equal(o.customer_name, input.customer.name);
  assert.equal(o.items.length, 1);
  report.checks.push(
    "saved real order and item snapshots, totals, customer details and all statuses",
  );
  const retry = await request("checkout", input);
  assert.equal(retry.body.order.reference, o.reference);
  report.checks.push("duplicate retry returns same order reference");
  const lookup = { reference: o.reference, email: input.customer.email };
  const found = await request("orders/lookup", lookup);
  assert.equal(found.status, 200);
  assert.equal(found.body.order.reference, o.reference);
  assert.equal(
    (
      await request("orders/lookup", {
        ...lookup,
        email: "wrong@example.invalid",
      })
    ).status,
    404,
  );
  assert.equal((await request("orders/lookup", lookup, "")).status, 404);
  report.checks.push(
    "owner/email order lookup; wrong owner and email rejected",
  );
  const ticketInput = {
    name: input.customer.name,
    email: input.customer.email,
    issue:
      "Automated HTTP live support persistence check; no real damage or delivery.",
    orderReference: o.reference,
    priority: "normal",
    idempotencyKey: state.ticketKey,
  };
  const ticket = await request("support", ticketInput);
  assert.equal(ticket.status, 201);
  const ticketRetry = await request("support", ticketInput);
  assert.equal(ticketRetry.body.ticket.id, ticket.body.ticket.id);
  report.checks.push("real linked support ticket and retry protection");
  report.status = "passed";
  report.order_reference = o.reference;
  report.ticket_id = ticket.body.ticket.id;
  console.log("LIVE HTTP PASS:", JSON.stringify(report));
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = 1;
  console.error("LIVE HTTP NOT VERIFIED:", error.message);
} finally {
  report.finished_at = new Date().toISOString();
  writeFileSync(
    ".data/live-http-result.json",
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
