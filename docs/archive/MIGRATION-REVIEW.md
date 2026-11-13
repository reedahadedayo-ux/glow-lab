> **Historical implementation record.** This is not the current project status. Start with the [current README](../../README.md), [architecture](../architecture.md) and [workflow audit](../workflows.md). Later deployments and database configuration may supersede statements below.

# Migration review: eight requirements

Project: `avebkyxbhwfzvivvcfmb` (GlowLab, created with explicit user permission).
The base migration was already applied under the earlier **APPROVED** message, before the
response was interrupted. The corrective migration below is additive; it does not remove
existing products, orders, tickets or integrations.

Full SQL: `supabase/REVIEW_COMPLETE.sql`. It includes **all table definitions, indexes,
constraints, RLS/grants, trigger definitions, both mutation functions, the additive correction,
and the complete insert-only 12-product seed**. Sections distinguish already-applied SQL
from the correction. Execute only the appropriate unapplied migration, not the whole review
package against an already-provisioned database.

## Confirmations

1. **12 existing products:** text IDs are preserved; prices are numeric(12,2); original image
   filenames remain unchanged. Seed uses ON CONFLICT DO NOTHING, never overwrites. The live
   product audit returned all 12 IDs, prices and image references. Correction touches no products.
2. **Independent statuses:** payment_status, order_status and new fulfillment_status. Checkout
   fixes these to paid / confirmed / unfulfilled respectively; payment_method is simulated.
   Nothing is automatically marked physically shipped. Legacy status values remain compatible.
3. **Items:** product_id FK, order_id FK, product_name snapshot, quantity, authoritative
   unit_price snapshot and generated line_total. RPC locks products, reads database prices,
   and saves stock/order/items in one transaction. No browser-supplied price is accepted.
4. **Customer and totals:** original private customer JSON snapshot stays intact. Correction
   adds customer_name, customer_email, customer_phone, delivery_address, delivery_city and
   delivery_instructions as generated stored projections, avoiding divergent copies.
   Explicit subtotal is backfilled and required. shipping_fee is a generated stored alias of
   existing delivery_fee. CHECK(total = subtotal + shipping_fee); demo fee remains zero.
5. **Uniqueness/retries:** UUID order ID and unique order reference, UNIQUE(owner_hash,
   idempotency_key), transaction advisory lock and normalized backend fingerprint. Identical
   retry returns the saved order; changed payload/key conflict is rejected.
6. **Private data:** all six tables have RLS enabled. No anon/authenticated schema usage or
   table grants, no public policies, no public RPC execute rights. Direct anon order reads
   and authenticated support reads already returned PostgreSQL 42501 on the live database.
   Server service role bypasses RLS intentionally and must never be sent to the browser.
7. **Backend:** POST /api/checkout performs Zod validation, derives owner from HttpOnly guest
   cookie and a backend secret, computes request fingerprint and invokes the server-only RPC.
   Lookup uses owner + reference + checkout email. Linked tickets verify the same identity.
   RPCs are SECURITY INVOKER with empty search_path and only service-role execution grants.
   SQL connector tests are not website HTTP endpoint tests. Direct sandbox HTTPS currently
   fails; full storefront-to-Supabase HTTP verification is still pending.
8. **Future seller app:** same tables, FKs, timestamp/status indexes and independent fulfillment
   status can be queried by a separately authenticated/authorized seller backend. No new
   database is required. Do not expose service-role credentials to a seller browser; implement
   seller authorization separately. No seller application is built in this scope.

## Correction files / compatibility

- Already applied: base contract, remote version `20261113092946`.
- Already applied: REST role schema configuration, remote version `20261113093042`.
- Correction applied after this review: `supabase/migrations/20261113093538_glowlab_order_fields.sql`,
  remote version `20261113093538` (`glowlab_order_fields`).
- Existing order references, item snapshots, original customer JSON and timestamps are retained.
  Backfill updates can advance updated_at through the existing timestamp trigger.
- shipping_fee/customer projections are generated; edit their source fields rather than
  attempting to write generated columns. subtotal, total and source fee must remain consistent.
- No destructive down migration. Roll back application changes without deleting collected data.

## Verified after application

Live catalogue comparison: 12 exact ID/price/image matches, zero mismatches. The original
order and linked ticket are preserved. A new real database order stores all added fields
and all three independent statuses. See LIVE-INTEGRATION.md for references, results and
the explicitly failed/unverified HTTP integration check.
