import { createClient } from "@supabase/supabase-js";
import { AppError } from "./validation.js";
import { databaseError } from "./database-errors.js";
export class SupabaseStore {
  constructor(env, { fetch: transport = globalThis.fetch } = {}) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error(
        "Configure the backend Supabase URL and service-role/secret key.",
      );
    const endpoint = new URL(env.SUPABASE_URL);
    if (endpoint.protocol !== "https:")
      throw new Error("Supabase must use an HTTPS project URL.");
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (key.startsWith("sb_publishable_"))
      throw new Error(
        "A publishable key cannot perform backend order operations. Use a server-only secret key.",
      );
    if (key.split(".").length === 3) {
      let claims;
      try {
        claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
      } catch {
        throw new Error("The configured Supabase credential is malformed.");
      }
      if (claims.role !== "service_role")
        throw new Error(
          "The backend requires a service-role credential, not an anon key.",
        );
      if (
        claims.ref &&
        endpoint.hostname.endsWith(".supabase.co") &&
        endpoint.hostname.split(".")[0] !== claims.ref
      )
        throw new Error(
          "Supabase URL and credential belong to different projects.",
        );
      if (claims.exp && claims.exp * 1000 <= Date.now())
        throw new Error("The configured Supabase credential has expired.");
    }
    this.db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      db: { schema: env.SUPABASE_DB_SCHEMA || "glowlab" },
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, options = {}) =>
          transport(url, {
            ...options,
            signal: options.signal
              ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
              : AbortSignal.timeout(10000),
          }),
      },
    });
  }
  check(error, status, operation) {
    const failure = databaseError(error, status, operation);
    if (failure) throw failure;
  }
  async products() {
    const { data, error, status } = await this.db
      .from("products")
      .select(
        "id,name,brand,price,image,category,skin_type,description,ingredients,usage,details_verified,available,stock",
      )
      .order("name")
      .retry(false);
    this.check(error, status, "products");
    return data;
  }
  async policies() {
    const { data, error, status } = await this.db
      .from("store_policies")
      .select("slug,title,content")
      .eq("published", true)
      .retry(false);
    this.check(error, status, "policies");
    return data;
  }
  async checkout(owner, input, fingerprint) {
    const { data, error, status } = await this.db.rpc("create_demo_order", {
      p_owner: owner,
      p_customer: input.customer,
      p_items: input.items,
      p_key: input.idempotencyKey,
      p_fingerprint: fingerprint,
    });
    this.check(error, status, "checkout");
    return data;
  }
  // Cross-session verification is deliberately separate from owner-bound access.
  // Projection excludes customer contact/address, internal IDs and all other records.
  async verifiedOrder(reference, email) {
    const { data, error, status } = await this.db
      .from("orders")
      .select(
        "reference,order_status,fulfillment_status,payment_status,payment_method,subtotal,shipping_fee,total,currency,created_at",
      )
      .eq("reference", reference)
      .eq("customer->>email", email)
      .maybeSingle()
      .retry(false);
    this.check(error, status, "order_lookup");
    return data;
  }
  async order(owner, reference, email) {
    let q = this.db
      .from("orders")
      .select(
        "id,reference,customer,items:order_items(product_id,product_name,quantity,unit_price,line_total),subtotal,total,delivery_fee,shipping_fee,currency,payment_status,payment_method,order_status,fulfillment_status,customer_name,customer_email,customer_phone,delivery_address,delivery_city,delivery_instructions,created_at",
      )
      .eq("owner_hash", owner)
      .eq("reference", reference.toUpperCase());
    if (email) q = q.eq("customer->>email", email.toLowerCase());
    const { data, error, status } = await q.maybeSingle().retry(false);
    this.check(error, status, "order_lookup");
    return data;
  }
  async ticket(owner, input, idem) {
    if (
      input.orderReference &&
      !(await this.order(owner, input.orderReference, input.email))
    )
      throw new AppError(
        404,
        "Order not found or could not be verified in this browser.",
      );
    const { data, error, status } = await this.db.rpc(
      "create_customer_ticket",
      {
        p_owner: owner,
        p_input: input,
        p_key: idem,
      },
    );
    this.check(error, status, "support_ticket");
    return data;
  }
}
