import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { catalogue } from "./catalogue.js";
import policies from "../data/policies.json" with { type: "json" };
import { AppError, priceCart } from "./validation.js";
export class LocalStore {
  constructor(file = ".data/glowlab.sqlite") {
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, owner TEXT NOT NULL, idem TEXT NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(owner,idem)); CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY, owner TEXT NOT NULL, idem TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(owner,idem));`,
    );
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO products VALUES (?,?)",
    );
    for (const p of catalogue) insert.run(p.id, JSON.stringify(p));
  }
  async products() {
    return this.db
      .prepare("SELECT data FROM products")
      .all()
      .map((r) => JSON.parse(r.data));
  }
  async policies() {
    return policies;
  }
  async checkout(owner, input, fingerprint) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const old = this.db
        .prepare("SELECT fingerprint,data FROM orders WHERE owner=? AND idem=?")
        .get(owner, input.idempotencyKey);
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new AppError(
            409,
            "This checkout key was already used for a different order.",
          );
        this.db.exec("COMMIT");
        return JSON.parse(old.data);
      }
      const items = priceCart(
        this.db
          .prepare("SELECT data FROM products")
          .all()
          .map((r) => JSON.parse(r.data)),
        input.items,
      );
      const order = {
        id: randomUUID(),
        reference: `GL-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        customer: input.customer,
        items,
        total: items.reduce((s, i) => s + i.line_total, 0),
        subtotal: items.reduce((s, i) => s + i.line_total, 0),
        delivery_fee: 0,
        shipping_fee: 0,
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
        delivery_address: input.customer.address,
        delivery_city: input.customer.city,
        delivery_instructions: input.customer.instructions,
        currency: "NGN",
        payment_status: "paid",
        payment_method: "simulated",
        order_status: "confirmed",
        fulfillment_status: "unfulfilled",
        created_at: new Date().toISOString(),
      };
      for (const item of items) {
        const p = JSON.parse(
          this.db
            .prepare("SELECT data FROM products WHERE id=?")
            .get(item.product_id).data,
        );
        if (p.stock !== null) {
          p.stock -= item.quantity;
          this.db
            .prepare("UPDATE products SET data=? WHERE id=?")
            .run(JSON.stringify(p), p.id);
        }
      }
      this.db
        .prepare("INSERT INTO orders VALUES (?,?,?,?,?)")
        .run(
          order.id,
          owner,
          input.idempotencyKey,
          fingerprint,
          JSON.stringify(order),
        );
      this.db.exec("COMMIT");
      return order;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async order(owner, reference, email) {
    const row = this.db
      .prepare(
        "SELECT data FROM orders WHERE owner=? AND json_extract(data,'$.reference')=?",
      )
      .get(owner, reference.toUpperCase());
    const o = row ? JSON.parse(row.data) : null;
    return o && (!email || o.customer.email === email.toLowerCase()) ? o : null;
  }
  async ticket(owner, input, idem) {
    const old = this.db
      .prepare("SELECT data FROM tickets WHERE owner=? AND idem=?")
      .get(owner, idem);
    if (old) return JSON.parse(old.data);
    if (
      input.orderReference &&
      !(await this.order(owner, input.orderReference, input.email))
    )
      throw new AppError(
        404,
        "Order not found or could not be verified in this browser.",
      );
    const ticket = {
      id: `SUP-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
      ...input,
      status: "open",
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare("INSERT INTO tickets VALUES (?,?,?,?)")
      .run(ticket.id, owner, idem, JSON.stringify(ticket));
    return ticket;
  }
}
