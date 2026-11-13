> **Historical implementation record.** This is not the current project status. Start with the [current README](../../README.md), [architecture](../architecture.md) and [workflow audit](../workflows.md). Later deployments and database configuration may supersede statements below.

> Latest verification: **23 automated tests and 38 browser journey/page/viewport groups pass**. The additional browser groups verify deliberate Express 503 recovery, preserved cart, disabled checkout, independent Contact/policies, and catalogue recovery. Supabase adapter tests use the official SDK with mocked HTTP transport, not the live database. Read PRODUCTION-READINESS.md for the failed real network probe and open live gates.

# Local test report — 2026-11-13

**Live Supabase connector results and the failed/unverified real HTTP probe are documented
separately in LIVE-INTEGRATION.md. They are not part of the local pass counts below.**

## Executed locally

- `npm test`: **17 passing tests**, no failures. Real local SQLite and local PostgreSQL/PGlite.
- `npm run test:browser`: **33 passing journey/page/viewport groups**, no observed page or
  browser console errors. Uses npm-distributed headless Chromium with Playwright, real local
  SQLite, and **mocked Gemini SDK transport only**. No runtime mock is exposed in the app.
- `node scripts/build-public.js`: builds allowlisted static assets successfully; output ignored.
- `npm audit` during install: zero reported vulnerabilities at time of execution.

### API/storage/security coverage

Existing 12-product IDs/prices, no unverified ingredients; backend subtotal calculation and
price/status tamper rejection; malformed email, missing product, duplicate lines, negative and
fractional quantities; retry-key reuse/conflict and simultaneous duplicate requests; stock decrement/rollback; order/email/owner
verification and generic invalid reference errors; ticket persistence and approval idempotency;
wrong-owner linked-ticket rejection; cross-origin/non-JSON rejection and HTTPS reverse-proxy origin acceptance; sensitive paths and removed public
automation URL 404; reopening a disk database preserves orders/tickets; missing integrations
cannot claim persistence; genuine model-requested function execution/response loop using a
mock transport; missing API key, forged/cross-owner history, Gemini rate limit and empty output.

### PostgreSQL contract coverage

Base and additive migrations run twice without losing data; 12-product seed parity; backfill
preserves order IDs/references/customer snapshots/creation timestamps/items; independent
fulfillment and generated customer/shipping fields with subtotal/total constraints; category/product FKs; atomic order snapshots,
authoritative totals, simulated paid/confirmed fields, stock update, idempotent retry, stock
rollback, changed-request conflict, invalid customer rejection, persistent linked ticket,
idempotent ticket, owner verification, all six tables RLS-enabled, anonymous private reads/RPC
calls denied, service-role access allowed. PGlite is **not** the user's Supabase instance and
these checks do not verify that instance's existing policies or PostgREST exposed schema.

### Browser coverage

Nine pages at 1440px, 768px and 390px, no horizontal overflow; mobile menu opens and navigates;
images decode; no legacy chatbot scripts, automation navigation or checkout navigation;
search/filter/details; add/remove/increment/decrement/refreshed cart; basic routine returned
through model/tool loop, no auto-add, selected products added on explicit approval; native
checkout validation; successful saved simulated order with reference and refreshed confirmation;
Lumi order lookup; support draft not persisted until approval, then saved ticket ID.
Screenshots saved to ignored `test-results/` and manually reviewed (desktop/mobile home, chat).

## Baseline bugs reproduced/fixed

Original mobile menu was `display:none` after opening. Original Contact/newsletter only used
fake success timers. During testing, corrected a phone HTML pattern invalid under modern
Unicode `v` regex semantics. Removed unverified sample chat advice and stale real-payment/
delivery/human-support promises. Backend prices/statuses are never accepted from the browser.

## Not tested / not claimed

- Real Google Gemini responses, quota/model permissions, adversarial medical/policy accuracy.
- Live Supabase is not exercised by this local suite. Actual connector-level schema, RLS and
  write results are recorded separately in LIVE-INTEGRATION.md; website HTTP integration remains unverified.
- Live Vercel URL, deployment, serverless rewrite and production cookie behaviour.
- Cross-browser Safari/Firefox, actual phone hardware, screen-reader audit, load/concurrency
  benchmarks or a shared production rate-limit store.

The final live acceptance gate remains open; see HANDOVER.md.
