> **Historical implementation record.** This is not the current project status. Start with the [current README](../../README.md), [architecture](../architecture.md) and [workflow audit](../workflows.md). Later deployments and database configuration may supersede statements below.

# Live Supabase integration record — 2026-11-13

## Current result, without conflating test layers

The user explicitly replaced the existing-project-only requirement and authorized a new
project, then approved the schema. Actual database migrations and real database-function
checkout/support tests have now run successfully through the Supabase connector.
**The customer website's HTTP-to-Supabase integration has not passed.** An actual attempt
using the real adapter failed on catalogue retrieval (503) before HTTP checkout could run.
No local/mock test is represented here as a live success. No real money was charged.

## Project / access

- Name: GlowLab; reference: `avebkyxbhwfzvivvcfmb`.
- Organization: `reedahadedayo-ux's Org`, `qzconbegzuoarzzlzvjd`.
- Region: `eu-west-1` (Ireland); creation requested the free plan, no paid upgrade.
- Dashboard: https://supabase.com/dashboard/project/avebkyxbhwfzvivvcfmb
- API base: https://avebkyxbhwfzvivvcfmb.supabase.co
- Database/REST/auth health checks reported healthy.
- Initial live application schema query returned no tables in public or glowlab.
- Generated database password is in ignored owner-only workspace storage. Existing service-role
  credentials were retrieved for backend configuration; no API key was created or rotated.
- `.env.supabase` stores the backend URL/schema/service-role credential and stable session
  secret, mode 0600, ignored by Git. It does not contain a configured Gemini key. Secrets
  are not in HTML, JS assets, SQL review files or this report. No Vercel environment was changed.
- Preview remains **local-demo**, not silently switched to a nonworking live adapter.

## Changes actually applied

| Remote version | Name                         | Local source                                                        |
| -------------- | ---------------------------- | ------------------------------------------------------------------- |
| 20261113092946 | glowlab_customer_contract    | supabase/migrations/20261113092946_glowlab_customer_contract.sql    |
| 20261113093042 | glowlab_expose_server_schema | supabase/migrations/20261113093042_glowlab_expose_server_schema.sql |
| 20261113093538 | glowlab_order_fields         | supabase/migrations/20261113093538_glowlab_order_fields.sql         |

Local migration filenames are aligned with the remote migration versions to avoid accidental
reapplication by future migration tooling. Do not apply the review package as an extra migration.

Insert-only seed: `supabase/seed.sql` — six categories, **12 original demo products**, six
published demo policies. ON CONFLICT DO NOTHING; no prior values overwritten. Stock remains
NULL (untracked); availability is purchasable-in-demo, not a verified real inventory claim.
A live full comparison against all original ID/price/image tuples returned **12 exact matches,
0 mismatches** after the additive migration. No existing project, table, record, bucket or
function was deleted. Existing order/item/ticket/customer snapshots were retained.

The REST change sets authenticator's `pgrst.db_schemas` to `public,graphql_public,glowlab`
and requests config reload. The connector's management health info still reported
`public,graphql_public`; effective PostgREST schema exposure has **not been verified over HTTP**.
Check Dashboard Data API exposed schemas when completing the HTTP test. Do not grant public
private-table access to resolve schema exposure.

The full SQL, all RLS/grants, triggers and functions are in `supabase/REVIEW_COMPLETE.sql`.
It was presented before applying the additive correction. The package distinguishes baseline
SQL from the correction; it is a review artifact, not a command to blindly reapply everything.

## Actual final tables and columns

All application tables are in **glowlab**, not public. Types verified via information_schema.
Money uses numeric(12,2); times use timestamptz. UUID IDs use gen_random_uuid().

- **categories:** name text PK; created_at.
- **products:** id text PK; name, brand, description text; price numeric(12,2); image text;
  category text FK; skin_type text; ingredients jsonb; usage text nullable;
  details_verified boolean; available boolean; stock integer nullable; created_at, updated_at.
- **store_policies:** slug text PK; title, content text; published boolean; created_at, updated_at.
- **orders:** id UUID PK; reference text UNIQUE; owner_hash text; idempotency_key UUID;
  request_fingerprint text; customer jsonb; total numeric(12,2); delivery_fee numeric(12,2);
  currency text; payment_status text; payment_method text; order_status text; created_at,
  updated_at; **fulfillment_status text**; **subtotal numeric(12,2)**;
  **shipping_fee numeric(12,2) GENERATED ALWAYS AS (delivery_fee) STORED**;
  **customer_name, customer_email, customer_phone, delivery_address, delivery_city,
  delivery_instructions text GENERATED ALWAYS** from the corresponding customer JSON fields.
- **order_items:** id UUID PK; order_id UUID FK; product_id text FK; product_name text snapshot;
  quantity integer (1–20); unit_price numeric(12,2) snapshot; line_total numeric(12,2)
  GENERATED ALWAYS AS(quantity * unit_price) STORED; UNIQUE(order_id,product_id).
- **support_tickets:** id text PK; owner_hash text; idempotency_key UUID; customer_name,
  customer_email, issue text; order_reference text nullable FK; priority text; status text;
  created_at, updated_at; UNIQUE(owner_hash,idempotency_key).

Customer snapshot keys are name/email/phone/address/city/instructions. Generated projection
columns cannot diverge from that snapshot. For future seller operations, edit source customer
JSON rather than generated columns. shipping_fee is a compatibility alias; edit source
`delivery_fee` only in a future approved pricing change. Current demo constrains it to zero.
subtotal is required; CHECK(total = subtotal + shipping_fee) and CHECK(subtotal >= 0).

Independent statuses:

- payment_status: paid or refunded; checkout chooses paid.
- payment_method: simulated only.
- order_status: confirmed, processing, shipped, delivered, cancelled (legacy-compatible);
  checkout chooses confirmed.
- fulfillment_status: unfulfilled, processing, shipped, delivered, cancelled; checkout chooses
  **unfulfilled**, never pretends a real dispatch happened.

### Verified foreign-key relationships

- products.category → categories.name.
- order_items.order_id → orders.id.
- order_items.product_id → products.id.
- support_tickets.order_reference → orders.reference.

Indexes include owner/reference, order creation time, fulfillment/creation time, item order ID,
product category, support status/creation time and support order reference. The timestamp
trigger updates updated_at on products/policies/orders/tickets. Backfill can advance updated_at;
it does not change IDs, references, created_at, prices, customer source snapshots or item rows.

## Actual RLS, grants and function security

Live pg_class/pg_policies/privilege checks after the correction:

- RLS **enabled on all six tables**.
- **Zero public policies**. Default deny is intentional; not a missing permissive policy.
- No anon/authenticated schema usage, private table SELECT or mutation function execution.
- service_role has schema usage and table DML; only it can execute the two customer mutation
  functions. It is privileged and bypasses RLS, so HTTP backend ownership checks are mandatory.
- Both mutation functions are **SECURITY INVOKER**, with empty search_path and fully qualified
  application tables. touch_updated_at is an internal trigger function, not a public RPC.

Actual live negative tests before correction: anonymous order read and authenticated support
read returned PostgreSQL **42501 permission denied for schema glowlab**. An attempt to create a
linked ticket with the wrong owner returned **P0001 Order not found or could not be verified**.
Privileges were rechecked after correction; no new public grants were introduced.

No seller authorization policies or seller app were built. A future separate authenticated
seller backend may use this same database, with its own authorization and backend-only
credentials. No second database is required.

## Order creation endpoint and functions

- Website endpoint (implemented, **not production/live-HTTP verified**): **POST /api/checkout**.
- Body: customer details, product IDs/quantities and UUID idempotencyKey only. Frontend prices,
  totals, payment status or fulfillment status are rejected by strict backend validation.
- Server derives owner from an HttpOnly browser cookie, computes normalized request fingerprint,
  and calls **glowlab.create_demo_order(text,jsonb,jsonb,uuid,text)**.
- PostgREST RPC path, when schema exposure is effective: `/rest/v1/rpc/create_demo_order` with
  Content-Profile glowlab and a **server-only** service-role credential; never call it directly
  from browser code.
- Atomic RPC locks owner/retry key and product rows, reads authoritative prices, calculates
  subtotal/total, updates tracked stock and saves order+item snapshots. UNIQUE(owner_hash,
  idempotency_key) and fingerprint check protect retries; same request returns the same order.
- Support RPC: **glowlab.create_customer_ticket(text,jsonb,uuid)**. It verifies linked order
  owner/email and persists a unique ticket. UI review approval precedes Lumi's ticket writes.
- Lookup: **POST /api/orders/lookup**, server filters owner + reference + checkout email.
  Reference/email alone are not identity; losing the original browser requires separate support.

## Real database test results (connector, not website HTTP)

### Original baseline order — preserved and backfilled

- ID: `2c253287-36b9-4ad3-9c27-e85cd567d170`.
- Reference: `[historical test reference omitted]`.
- created_at preserved: `2026-11-13T09:31:18.734161+00:00`.
- Two item rows, subtotal/total ₦38,800; shipping_fee ₦0.
- paid / simulated / confirmed / unfulfilled after correction.
- Original customer/delivery data remains stored (explicitly fictional test data).
- Linked ticket preserved: `[historical test reference omitted]` (open).

### New simulated order after additive correction

Executed actual deployed create_demo_order as **service_role** through the connector;
no LocalStore, in-memory database or SDK mock involved.

- ID: `d8013b02-d13a-45ff-b345-2ad459f4011c`.
- Reference: **[historical test reference omitted]**.
- created_at: `2026-11-13T09:36:04.879109+00:00`.
- Three saved lines: Beauty of Joseon Relief Sun ₦15,200 ×1; CeraVe Moisturizing Cream
  ₦17,800 ×1; CeraVe Foaming Facial Cleanser ₦14,500 ×1.
- **subtotal ₦47,500; shipping_fee ₦0; total ₦47,500**.
- **payment_status paid; payment_method simulated; order_status confirmed;
  fulfillment_status unfulfilled**.
- Fictional name/email/phone/address/city/instructions persisted in JSON and projected fields.
- New transaction re-read returned three item rows, snapshot sum ₦47,500, and one row for the
  owner/retry-key combination. Exact retry returned the same reference, not a duplicate.
- Persisted linked support ticket: **[historical test reference omitted]**, normal/open.
- Owner + reference + matching email query found the real order. Wrong-owner, wrong-email and
  unknown-reference predicates returned zero rows in earlier live checks. These verify SQL
  lookup predicates, not a successful website POST /api/orders/lookup HTTP test.

These two demo orders/tickets are retained intentionally for review; no real money, shipping
or notification was performed. They are not sales or real customer records.

## Updated transport diagnosis — 2026-11-13

Read **PRODUCTION-READINESS.md** for the current release gate and implementation changes.
`npm run diagnose:supabase` confirms valid backend configuration, matching service-role JWT,
resolved DNS, then ECONNRESET before any upstream HTTP response. Supabase SDK status is 0;
Express translates it to 503 with DATABASE_NETWORK and a safe request ID. This sandbox’s
outbound host list excludes Supabase and Gemini. No code fallback can legitimately fix that.
Connector health reports DB/REST/auth healthy; authenticator schema setting includes glowlab
and service-role usage/SELECT are granted. Effective HTTP exposure is still unverified.
No new migration or remote data mutation was performed during this diagnostic upgrade.

## Actual HTTP test attempt — FAILED / not verified

- Direct sandbox HTTPS probe to this project's Supabase API failed with SSL_ERROR_SYSCALL.
- Ran `node --env-file=.env.supabase scripts/test-live-supabase.js --allow-demo-writes`.
- The script starts the actual Express app with SupabaseStore only, no LocalStore/mock/fallback.
- `/api/config` reported Supabase mode, but `/api/products` returned **503**, not 200. It stopped
  **before checkout**. HTTP order/lookup/support steps therefore have not passed.
- Ignored `.data/live-http-result.json` records this failure, not a pass. Stable ignored retry
  state prevents accidental duplicate orders when the test is later run on a permitted host.

### Remaining gates

1. Provide backend network access to Supabase and verify Data API glowlab schema exposure.
2. Run `npm run test:live:supabase` from that permitted backend environment. It requires the
   ignored .env.supabase and explicitly authorizes fictional demo writes. It tests actual
   HTTP checkout, statuses, item snapshots, retry, lookup/privacy and linked ticket persistence.
3. Configure real production/Vercel backend environment variables without exposing them in Git
   or frontend code; no production deploy/environment mutation was performed here.
4. Configure GEMINI_API_KEY through secure backend settings and run real Gemini tool calls.
   No key is available and no live Gemini response has been claimed.

## Connection history

Initial connector was disconnected; when enabled it listed the organization but no projects.
The user then explicitly requested a new project. That changed the project-selection scope;
no inaccessible existing project was guessed, modified or deleted.
