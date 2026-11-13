# GlowLab readiness report — 13 November 2026

## Release decision: NOT yet production-ready

The storefront improvements are saved on the existing working branch. No production deployment, push, new database migration, or replacement project was performed in this upgrade. Original catalogue IDs, prices and image references remain unchanged.

## Actual 503 diagnosis

Fresh checks against `avebkyxbhwfzvivvcfmb`:

- Backend URL and JWT project reference agree; configured JWT role is `service_role` and the credential is unexpired. No credential values were printed.
- DNS resolves the Supabase host.
- The actual official Supabase SDK request fails with `ECONNRESET` **before any HTTP response**. PostgREST status is `0`; Express translates the transport failure to HTTP 503. The observed failure is not an HTTP 503 returned by Supabase itself.
- The sandbox only permits outbound access to a limited host list that does not include Supabase or Google's Gemini API. The reset is consistent with that network restriction. Application code cannot change the sandbox egress policy.
- The Supabase connector separately reports database, REST and auth healthy. Its SQL query confirms 12 products, service-role schema usage and product SELECT privileges, no anonymous schema usage, and authenticator `pgrst.db_schemas=public,graphql_public,glowlab`.
- Management health metadata still lists `public,graphql_public`. Effective HTTP schema exposure remains an open gate until a permitted backend can send the request. Do not grant private data to public roles or move private records to public tables to work around this.
- This app intentionally does not use a public browser Supabase key. Browser requests go to same-origin Express APIs; the privileged Supabase credential stays exclusively on the backend.

### Reproduce safely

On a host permitted to access this Supabase project, configure backend environment variables securely, then run:

```sh
npm run diagnose:supabase
npm run test:live:supabase
```

The first command is read-only and prints a sanitized preflight, not credentials or private records. It exits nonzero when not ready. The second explicitly allows fictional demo order/ticket writes; it retains stable ignored retry state to avoid duplicate records.

Latest preflight: configuration valid, DNS resolved, transport failed before HTTP response, `networkCode=ECONNRESET`, `errorCode=DATABASE_NETWORK`, `ready=false`.

Latest real HTTP test: `/api/products` returned 503 with `DATABASE_NETWORK`; stopped before checkout. **No live HTTP checkout success is claimed.** Its ignored `.data/live-http-result.json` includes a request ID to correlate with sanitized backend logs.

## Improvements made

- Removed the unconfigured static catalogue fallback: product APIs fail closed instead of showing substitute products.
- Added `/api/ready`, which actually reads the configured database, rather than treating configuration as connection success. `/api/config` remains configuration metadata only.
- Added database-sourced `GET /api/products/:id`; existing product details UI remains in place.
- Validated server credentials early against publishable/anonymous keys, wrong-project JWTs, expired JWTs and non-HTTPS URLs.
- Bounded each database fetch to ten seconds; disabled automatic read retry loops so outages do not repeatedly stall page loads. Checkout retry identity remains server-enforced.
- Classified transport, credentials, schema exposure, missing relations/functions and permission faults. Customer responses contain safe messages, error codes and request IDs; backend logs omit tokens, SQL, private customer data and raw upstream messages.
- Catalogue failure preserves the stored cart, exposes a working retry control, and keeps checkout disabled. Contact, policy retrieval and private confirmation lookup are no longer gated on catalogue retrieval.
- Cart quantity controls respect current catalogue limits. Confirmation says the demo order is saved, without implying shipment.
- Removed remaining unsubstantiated Lagos-team, nationwide-delivery, expert/dermatologist and authenticity-adjacent marketing claims. Retained original product imagery and brand styling. Replaced platform-dependent emoji icons with local inline SVG line icons.
- Preserved official backend Gemini SDK and model-decided tools, explicit cart selection/approval, browser capability + email order privacy, signed support drafts and persisted-ticket confirmation. No scripted AI runtime fallback was introduced.

## Test results and boundaries

- **23/23 automated backend/schema/adapter tests pass.** Includes real local PostgreSQL-compatible schema tests, local SQLite checkout/privacy/ticket checks and new official Supabase SDK adapter tests with **mock HTTP transport**. Adapter tests are not live database evidence.
- **38 browser journey/page/viewport groups pass.** Includes search, filters, product details, cart refresh/quantities/totals, checkout/confirmation, Lumi approval and support review, mobile navigation and deliberate 503 recovery. The recovery checks use a real Express error response with an injected catalogue fault. SQLite is real; Gemini transport is explicitly mocked. No unexpected console/page errors.
- Build, formatting and whitespace checks pass.
- Previously verified connector-level SQL writes, snapshots, statuses, retry protection, RLS/grants and preservation remain documented in `LIVE-INTEGRATION.md`. They are not a substitute for website HTTP acceptance.

## Remaining release gates

1. Provide backend network access to Supabase (or connect Vercel to deploy the existing app to a permitted host). Vercel was checked and is currently disconnected. No deployment was attempted.
2. Run the live HTTP suite there; verify all 12 original catalogue tuples, actual schema exposure, saved order/items, authoritative totals, paid/simulated/confirmed/unfulfilled statuses, duplicate protection, lookup privacy and persistent support. Then run the browser journey against that same Supabase-backed host.
3. Set `GEMINI_API_KEY` through secure backend settings on a host allowed to reach Gemini. No key is configured here. Verify real model/tool calls, routines, approval, policies, private lookup, saved support and sensitive-topic escalation. Prompt rules and mocked SDK orchestration tests do **not** establish real model accuracy.
4. Keep all checkout/payment/delivery simulation notices. Current policies are explicitly demo policies, not verified real business commitments. Obtain approved operational policies and manufacturer details before making real claims.
5. Before broad public traffic: shared multi-instance rate limits/budget caps, production cookie/origin checks, retention rules and cross-device recovery decisions. Email alone must never unlock another browser's orders.

Do not call this release complete until the live HTTP and Gemini gates pass. Never fix a network outage by silently switching to SQLite or a static catalogue.
