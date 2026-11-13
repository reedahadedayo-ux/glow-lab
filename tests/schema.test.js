import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { catalogue } from "../server/catalogue.js";
import { randomUUID } from "node:crypto";
test("PostgreSQL migrations: schema, atomic checkout, constraints, stock, tickets and deny-by-default grants (PGlite, NOT live Supabase)", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    const sql = readFileSync(
      "supabase/migrations/20261113092946_glowlab_customer_contract.sql",
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    const correction = readFileSync(
      "supabase/migrations/20261113093538_glowlab_order_fields.sql",
      "utf8",
    );
    await db.exec(correction);
    await db.exec(correction);
    for (const category of [...new Set(catalogue.map((p) => p.category))])
      await db.query("INSERT INTO glowlab.categories(name) VALUES ($1)", [
        category,
      ]);
    const p = catalogue[0];
    await db.query(
      "INSERT INTO glowlab.products(id,name,brand,description,price,image,category,available,stock) VALUES ($1,$2,$3,$4,$5,$6,$7,true,3)",
      [p.id, p.name, p.brand, p.description, p.price, p.image, p.category],
    );
    const customer = {
      name: "Demo Person",
      email: "demo@example.com",
      phone: "+234 800 0000",
      address: "12 Demo Street",
      city: "Jos",
    };
    const items = [{ productId: p.id, quantity: 2 }];
    const owner = "a".repeat(64),
      fingerprint = "b".repeat(64),
      key = randomUUID();
    const checkout = async (
      c = customer,
      i = items,
      k = key,
      f = fingerprint,
    ) => {
      const result = await db.query(
        "select glowlab.create_demo_order($1,$2,$3,$4,$5) as saved",
        [owner, JSON.stringify(c), JSON.stringify(i), k, f],
      );
      return result.rows[0].saved;
    };
    const order = await checkout();
    assert.equal(Number(order.total), 29000);
    assert.equal(order.payment_status, "paid");
    assert.equal(order.payment_method, "simulated");
    assert.equal(order.order_status, "confirmed");
    assert.equal(order.fulfillment_status, "unfulfilled");
    assert.equal(Number(order.subtotal), 29000);
    assert.equal(Number(order.shipping_fee), 0);
    assert.equal(order.customer_name, customer.name);
    assert.equal(order.customer_email, customer.email);
    assert.equal(order.customer_phone, customer.phone);
    assert.equal(order.delivery_address, customer.address);
    assert.equal(order.items.length, 1);
    assert.equal(Number(order.items[0].line_total), 29000);
    assert.equal(order.owner_hash, undefined);
    assert.equal((await checkout()).reference, order.reference);
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM glowlab.orders")).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query("SELECT stock FROM glowlab.products")).rows[0].stock,
      1,
    );
    await assert.rejects(
      checkout(customer, items, randomUUID()),
      /insufficient stock/,
    );
    await assert.rejects(
      checkout(
        customer,
        [{ productId: p.id, quantity: 1 }],
        key,
        "c".repeat(64),
      ),
      /different order/,
    );
    await assert.rejects(
      checkout({ ...customer, name: undefined }, items, randomUUID()),
      /Invalid delivery/,
    );
    const ticketInput = {
      name: customer.name,
      email: customer.email,
      issue: "Please record this demo issue.",
      orderReference: order.reference,
      priority: "normal",
    };
    const ticketKey = randomUUID();
    const createTicket = async (o = owner) => {
      const r = await db.query(
        "select glowlab.create_customer_ticket($1,$2,$3) as saved",
        [o, JSON.stringify(ticketInput), ticketKey],
      );
      return r.rows[0].saved;
    };
    const ticket = await createTicket();
    assert.match(ticket.id, /^SUP-/);
    assert.equal((await createTicket()).id, ticket.id);
    await assert.rejects(createTicket("d".repeat(64)), /could not be verified/);
    const rls = await db.query(
      "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='glowlab' and c.relkind='r'",
    );
    assert.equal(rls.rows.length, 6);
    assert.ok(rls.rows.every((r) => r.relrowsecurity));
    await db.exec("SET ROLE anon");
    await assert.rejects(
      db.query("select * from glowlab.orders"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from glowlab.support_tickets"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select glowlab.create_demo_order($1,$2,$3,$4,$5)", [
        owner,
        JSON.stringify(customer),
        JSON.stringify(items),
        key,
        fingerprint,
      ]),
      /permission denied/,
    );
    await db.exec("RESET ROLE; SET ROLE service_role");
    assert.equal(
      (await db.query("select count(*)::int n from glowlab.orders")).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

test("additive correction preserves all 12 products and existing orders/items while backfilling fulfillment, projections and totals (local PostgreSQL)", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261113092946_glowlab_customer_contract.sql",
        "utf8",
      ),
    );
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    const beforeProducts = (
      await db.query("SELECT id,price,image FROM glowlab.products ORDER BY id")
    ).rows;
    assert.equal(beforeProducts.length, 12);
    for (const p of catalogue) {
      const row = beforeProducts.find((r) => r.id === p.id);
      assert.equal(Number(row.price), p.price);
      assert.equal(row.image, p.image);
    }
    const customer = {
      name: "Legacy Demo Customer",
      email: "legacy@example.invalid",
      phone: "+2348000000000",
      address: "12 Fictional Demo Street",
      city: "Jos",
    };
    const params = [
      "a".repeat(64),
      JSON.stringify(customer),
      JSON.stringify([{ productId: "cerave-foaming", quantity: 2 }]),
      randomUUID(),
      "b".repeat(64),
    ];
    const before = (
      await db.query(
        "SELECT glowlab.create_demo_order($1,$2,$3,$4,$5) AS saved",
        params,
      )
    ).rows[0].saved;
    const migration = readFileSync(
      "supabase/migrations/20261113093538_glowlab_order_fields.sql",
      "utf8",
    );
    await db.exec(migration);
    const after = (
      await db.query(
        "SELECT glowlab.create_demo_order($1,$2,$3,$4,$5) AS saved",
        params,
      )
    ).rows[0].saved;
    for (const field of [
      "id",
      "reference",
      "created_at",
      "customer",
      "items",
      "total",
      "payment_status",
      "order_status",
    ])
      assert.deepEqual(after[field], before[field]);
    assert.equal(after.customer_name, customer.name);
    assert.equal(after.customer_email, customer.email);
    assert.equal(after.delivery_address, customer.address);
    assert.equal(after.fulfillment_status, "unfulfilled");
    assert.equal(Number(after.subtotal), 29000);
    assert.equal(Number(after.shipping_fee), 0);
    assert.deepEqual(
      (
        await db.query(
          "SELECT id,price,image FROM glowlab.products ORDER BY id",
        )
      ).rows,
      beforeProducts,
    );
    await assert.rejects(
      db.query("UPDATE glowlab.orders SET subtotal=1 WHERE id=$1", [after.id]),
      /orders_total_components_check/,
    );
    await assert.rejects(
      db.query(
        "UPDATE glowlab.orders SET customer_name='Divergent copy' WHERE id=$1",
        [after.id],
      ),
      /generated column|non-DEFAULT|only be updated to DEFAULT/,
    );
    await db.query(
      "UPDATE glowlab.orders SET fulfillment_status='processing' WHERE id=$1",
      [after.id],
    );
    await db.exec(migration);
    const statuses = (
      await db.query(
        "SELECT payment_status,order_status,fulfillment_status FROM glowlab.orders WHERE id=$1",
        [after.id],
      )
    ).rows[0];
    assert.deepEqual(statuses, {
      payment_status: "paid",
      order_status: "confirmed",
      fulfillment_status: "processing",
    });
    await assert.rejects(
      db.query("SELECT glowlab.create_demo_order($1,$2,$3,$4,$5)", [
        null,
        ...params.slice(1),
      ]),
      /Invalid session/,
    );
  } finally {
    await db.close();
  }
});
