# GlowLab — customer storefront & Lumi

An in-place upgrade of the existing vanilla HTML/CSS/JS skincare demo. It preserves the
cream, sage and charcoal identity, original product IDs, NGN prices and local images.
**No seller dashboard, real payments, email workflows or analytics app.**

Read the latest [production-readiness report](docs/PRODUCTION-READINESS.md) for the precise 503 diagnosis, changes, 23 automated tests / 38 browser checks and open live acceptance gates. **This is not yet a production-ready release.**

## Current delivery status — 2026-11-13

- The user explicitly superseded the original existing-project-only rule and authorized a new
  project: **GlowLab**, reference `avebkyxbhwfzvivvcfmb`, region Ireland `eu-west-1`.
- **Applied and verified in live Supabase:** base schema, server-schema role configuration,
  additive fulfillment/customer/totals correction; six private tables; 12 existing catalogue
  products and six published demo policies; actual persisted orders/items and linked tickets.
- All **12 product IDs, prices and image references match exactly**, zero mismatches.
- Orders now have independent payment_status/order_status/fulfillment_status, explicit subtotal
  and shipping_fee, and queryable customer/delivery projections of the preserved private JSON.
- Real database function tests ran as service_role through the Supabase connector. Retrying an
  order/ticket returned the same reference/ID. Anonymous private reads were denied.
- **Website HTTP integration is NOT verified:** sandbox-to-Supabase HTTPS fails; an opt-in test
  of the real server adapter returned 503 on catalogue retrieval and stopped before checkout.
  Database connector tests are not a successful browser/HTTP end-to-end integration.
- Credentials are stored only in ignored, owner-readable `.env.supabase`. The running customer
  preview remains explicitly local; no production environment/deployment is claimed configured.
- **Gemini live calls remain unverified:** no Gemini API key has been configured. Runtime does
  not substitute a mock. Unit/browser tests inject a transport mock explicitly.

See [full SQL/RLS/function review](supabase/REVIEW_COMPLETE.sql),
[eight confirmations](docs/MIGRATION-REVIEW.md),
[actual live results/schema](docs/LIVE-INTEGRATION.md),
[architecture/API](docs/ARCHITECTURE.md), and [local test report](docs/TESTING.md).

## Quick start — honest local preview

Node **22+** and npm required.

```sh
npm ci
cp .env.example .env
# Edit .env: set DATA_BACKEND=local for a development-only database.
# Optionally set GEMINI_API_KEY for real Lumi requests on a network that permits Google.
npm run dev
```

Open `http://localhost:3000`. Server binds `0.0.0.0` for the Arena preview. The banner labels
local database mode. `.data/glowlab.sqlite` survives process restarts; `.data/session-secret`
is generated once for local session ownership. Both are ignored by Git. No public-preview
API keys are needed. Use fictional delivery details; no money is charged or goods shipped.

**Local mode is intentionally prohibited on Vercel/in production.** It is not a replacement
for the required central Supabase database. Default `DATA_BACKEND=supabase` fails closed for
writes when credentials are absent. A catalogue-only static preview is still available.
Do not use a generic static file server: it cannot provide checkout or Lumi and could expose
repository files. Use the allowlisted Express server or the Vercel build below.

### Database setup / applied project

> **Current project is already provisioned. Do not reapply/seed blindly.** The instructions
> below are retained as the inspection process for any future existing-project integration.
> Remote migration versions and local file mappings are in LIVE-INTEGRATION.md.

1. Connect the **existing** project. Run `supabase/INSPECT_FIRST.sql` read-only. Inventory
   products/categories, customers, orders/items, routines, policies, RLS, functions, storage,
   integrations and counts. Back up the project. Record findings in `docs/AUDIT.md`.
2. Reuse compatible tables/data. Adapt `server/supabase-store.js`/RPC definitions to them;
   **do not blindly create a parallel catalogue or duplicate tables**.
3. Only if no reusable commerce schema exists, review the isolated `glowlab` proposal in
   `supabase/migrations/20261113092946_glowlab_customer_contract.sql` and follow-up migrations. It does not touch `public`,
   existing workflows or data. See `supabase/ROLLBACK.md`. Apply through the existing project's
   normal reviewed migration process. It is deliberately not auto-applied at startup.
4. If using that contract, expose `glowlab` in Supabase Data API settings. Grant nothing to
   anon/authenticated; the backend service role is the only data access path.
5. If appropriate **after reconciliation**, insert only missing demo seed rows:
   ```sh
   node --env-file=.env scripts/seed-supabase.js --existing-project-reviewed
   ```
   This guard is a human audit acknowledgment, not an automated schema audit. Seed never
   overwrites existing rows. Seed availability means purchasable in this demo, not verified
   real inventory. Stock is `NULL` (not tracked), never an invented quantity.
6. Set `DATA_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_DB_SCHEMA`, a stable random `SESSION_SECRET` (32+ chars), and `GEMINI_API_KEY`.
   Restart. Perform the live checks in `docs/HANDOVER.md`.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATA_BACKEND` | `supabase` default; `local` development only |
| `SUPABASE_URL` | Existing project's URL, server-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged backend only; never HTML, frontend JS or Git |
| `SUPABASE_DB_SCHEMA` | Audited schema; proposed default `glowlab` |
| `GEMINI_API_KEY` | Server only; official Google Gen AI SDK |
| `GEMINI_MODEL` | Default `gemini-2.5-flash`; select a model enabled for your key |
| `SESSION_SECRET` | Stable 32+ char secret; `openssl rand -hex 32` |
| `APP_ORIGIN` | Optional canonical HTTPS origin for strict CSRF checks |
| `PORT` | Local port, default 3000 |

No frontend service-role key, anon key or Gemini key is used. `.env*` is ignored except
`.env.example`. Do not print credentials in audit output. Rotating `SESSION_SECRET` invalidates
existing guest order access and signed conversation tokens; plan that change deliberately.

## Customer flow

1. Browse `/products.html`, filter or search, open a product detail modal.
2. Open Lumi anywhere; ask about skin type/preferences/budget. Gemini chooses backend tools.
3. Review the returned AM/PM routine. **Select** products and approve Add selected to cart.
4. Visit `/cart.html`, adjust quantities and proceed to `/checkout.html`.
5. Enter fictional delivery details and acknowledge the demo. No card/bank fields exist.
6. Backend validates IDs/quantities, retrieves prices, computes total and atomically stores
   order plus snapshots. `payment_status=paid`, `payment_method=simulated`,
   `order_status=confirmed`. A retry key prevents duplicate creation.
7. `/confirmation.html` re-fetches the saved record and shows its real reference. Save it.
8. Ask Lumi to look it up using reference and checkout email in the **same browser session**.
9. Report a problem. Review and explicitly submit the ticket draft; only successful database
   persistence produces a ticket ID. Contact also saves a real support ticket, not an email.

Products/ingredients/benefits are not fabricated. The original catalogue snapshot is retained
in `data/catalogue-original.json`, not published. Unverified ingredients/usage/marketing claims
are excluded from active API responses. Imagery is retained demo imagery, not an authenticity
certification. Published demo policies explicitly distinguish illustration from real shipping.

## Tests

```sh
npm test                 # API/storage/security/Gemini orchestration + PostgreSQL schema tests
npm run test:browser     # headless full customer journey; mocked Gemini, real SQLite
npm run test:live:supabase # OPT-IN real HTTP/database writes; needs .env.supabase + network
node scripts/build-public.js  # generates allowlisted deployment assets, no secrets
```

Browser tests use npm-distributed Chromium to work where the Playwright download CDN is
blocked. Linux x64 required for the bundled fallback; on other systems adapt launch to an
installed Playwright Chromium. Generated databases/screenshots/reports and dependencies
are ignored. See `docs/TESTING.md` for observed results and limitations.

## Vercel — prepared, not deployed

Import the current branch. Node 22+, install `npm ci`. `vercel.json` builds allowlisted static
assets into ignored `public/`, with `/api/*` routed to `api/index.js` (Express). Do not deploy
the whole repository as a public directory. Set production environment variables to the
**existing Supabase project** and a Gemini key; local mode is rejected. Configure a 120-second
function duration if your plan permits it, and appropriate network access. Static pages work
with clean URLs; legacy duplicate page paths redirect. The removed public automation URL 404s.
Verify actual deployed routes, cookies, API rewrite, RLS and end-to-end behaviour before calling
this deployed. No deploy/push/PR has been performed in this session.

Rollback checkpoint: `rollback/pre-customer-upgrade-9857747`. Git history was preserved.
