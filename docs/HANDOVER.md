# Handover / remaining live acceptance gate

See **PRODUCTION-READINESS.md** for the latest diagnosis: actual SDK transport ECONNRESET before HTTP, not a Supabase HTTP 503; validated configuration/DNS and healthy connector services do not establish website connectivity. New diagnostics and fail-closed APIs are implemented. Latest local verification: 23 automated tests, 38 browser groups.

## Current state

The user authorized a new Supabase project and approved its schema. `GlowLab`
(`avebkyxbhwfzvivvcfmb`, eu-west-1) has applied migrations, 12 original demo catalogue
records, six policies, actual test orders/items and linked support tickets.

Read **LIVE-INTEGRATION.md** for exact remote migration versions, actual final tables/columns,
FKs, RLS/grants, records and test-layer distinctions. Read **MIGRATION-REVIEW.md** for the eight
requested confirmations. Full SQL including all grants/triggers/functions is **supabase/REVIEW_COMPLETE.sql**.
Never blindly reapply the review bundle to a provisioned database.

Orders now have independent payment_status/order_status/fulfillment_status, explicit subtotal,
generated shipping_fee alias and generated customer/delivery projections. The original data,
IDs, references, images/prices and snapshots were preserved and verified. No seller dashboard,
email workflow, real payment or shipping integration was built.

## What passed live (Supabase connector / real database)

- Applied base + server-schema configuration + additive status/customer/totals migration.
- 12 exact catalogue ID/price/image matches, zero mismatches.
- Actual service-role order and item creation; saved authoritative totals and customer details.
- paid / simulated / confirmed / unfulfilled values persisted.
- Retry returns same reference and one owner/key row. Support tickets persist and retries are safe.
- Original order/items/customer snapshot/reference/created_at and support ticket preserved.
- RLS enabled, public reads/RPCs denied, wrong-owner linked-ticket creation rejected.

These are not mocked or local tests. They are also **not** a successful browser/website HTTP
integration: they were executed through the connector against the deployed database functions.

## What remains blocked / unverified

1. Sandbox-to-Supabase HTTPS fails. The actual server adapter HTTP probe returned 503 on
   catalogue retrieval and correctly stopped before checkout. Keep this failure visible.
2. Verify effective Data API exposed schemas: authenticator role setting was changed, but
   the management health info still listed public,graphql_public. Do not weaken RLS or give
   private-table grants to public roles as a workaround.
3. Run `npm run test:live:supabase` on a backend with Supabase network access and secure env.
   It opts into fictional real database writes and tests actual HTTP checkout, retry, lookup,
   privacy and support. No local adapter or AI mock is used by this script.
4. Configure production backend env (URL/schema/service credential/stable session secret).
   `.env.supabase` in this workspace is ignored and owner-only; no Vercel environment was
   configured or deployment verified. The preview remains clearly labelled local-demo.
5. Configure GEMINI_API_KEY securely and run real Gemini function calls and adversarial checks.
   No key/live AI call is available; local/browser AI transport tests remain explicitly mocked.
6. Add shared abuse/rate limits and Gemini budget caps before broad public traffic.
7. Verify manufacturer ingredients/usage and replace illustrative policy copy only with approved
   real store policies before moving beyond a demo. Decide on data retention and authenticated
   cross-device recovery; email alone must not unlock private orders.

## Rollback / safety

Git tag `rollback/pre-customer-upgrade-9857747` preserves the storefront baseline. No history
was rewritten; no switch away from the assigned branch. SQL changes are additive. Application
rollback must not drop the schema or delete collected orders/tickets. Backfill may advance
updated_at via existing triggers; created_at and purchase snapshots remain intact.

Secrets remain out of Git/public assets. No production deploy/push/PR is claimed. Scope excludes
seller UI, seller authentication, emails, analytics, real payments and real courier fulfilment.
