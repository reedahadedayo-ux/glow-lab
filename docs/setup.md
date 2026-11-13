# Setup and configuration

[README](../README.md) · [Architecture](architecture.md) · [Testing](testing.md)

## Prerequisites

- Git, Node.js 22.x and npm. Audit commands ran with Node 22.22.3.
- Python 3 for the publication-review helper; it has no third-party dependencies.
- Linux x64 for the bundled headless Chromium browser-test setup. Other systems need a compatible browser launch adaptation; it is not claimed cross-platform tested.
- For central persistence: an authorised Supabase project with a reviewed compatible schema. Do not apply migrations to someone else's database or create a new project automatically.
- For live chat: privately configured Groq primary and Gemini fallback keys. Defaults are `openai/gpt-oss-20b` and `gemini-3.1-flash-lite`; real generation with both was verified on the preview-build host.

## Local development without external services

```sh
git clone https://github.com/reedahadedayo-ux/glow-lab.git
cd glow-lab
npm ci
cp .env.example .env
```

The repository is private; cloning requires the owner's authorised GitHub access. Work stays in this existing repository/branch; see [GitHub handoff](github-handoff.md).

Fill your ignored `.env` privately:

```dotenv
DATA_BACKEND=local
PORT=3000
```

Then `npm run dev` and open `http://localhost:3000`. The server binds `0.0.0.0` for hosted previews; browser API calls are relative to `/api`, not to a hard-coded backend host.

- SQLite is persisted at `.data/glowlab.sqlite`; a missing local secret is generated once at `.data/session-secret`. Both are Git-ignored.
- Local mode is an explicit real development database, not a fake success fallback for Supabase. It is rejected if `VERCEL` or production mode is set.
- Without provider keys, browsing/cart/checkout/support can run locally, while Lumi reports unavailability. If only Gemini is configured, requests skip unavailable Groq and use fallback; that is not a Groq verification. Only tests/probes inject explicit faults or mock model clients.
- Use fictional names/contact/delivery details, including locally. No real payment is collected or shipment arranged.
- Do not run `python -m http.server` against the repository root: it lacks the API and can expose files that the application intentionally does not serve.

## Server-side environment contract

The checked-in `.env.example` contains blank assignments only. Actual values belong in private local/deployment settings.

| Name                            | Required / meaning                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATA_BACKEND`                  | Set explicitly to `local` in development or `supabase` centrally. Missing mode does not grant permission to use production SQLite.                                                  |
| `SUPABASE_URL`                  | HTTPS endpoint for the authorised project.                                                                                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only service-role/secret key with the reviewed schema access. Never a browser key. Adapter rejects publishable, wrong-role, wrong-project or expired legacy JWT credentials. |
| `SUPABASE_DB_SCHEMA`            | Reviewed commerce schema, normally `glowlab`.                                                                                                                                       |
| `SESSION_SECRET`                | Stable random secret, at least 32 characters; required centrally. Generate privately, for example with `openssl rand -hex 32`. Never reuse test canaries.                           |
| `GROQ_API_KEY`, `GROQ_MODEL`    | Primary credential/model. Default `openai/gpt-oss-20b`; never browser-visible.                                                                                                      |
| `GEMINI_API_KEY`                | Optional locally; needed for actual Lumi generation. Never use a frontend/public-prefixed variable.                                                                                 |
| `GEMINI_MODEL`                  | Explicit account-supported model. Source default is `gemini-3.1-flash-lite`; historical model availability changed, so verify rather than copy an assumption.                       |
| `APP_ORIGIN`                    | Optional canonical origin for strict mutation origin checks. Local production-origin values can reject local browser POSTs.                                                         |
| `PORT`                          | Local port; default 3000.                                                                                                                                                           |
| `GLOWLAB_VERIFY_LIVE`           | `1` deliberately enables existing preview-only SDK/Supabase checks. Not a routine build setting.                                                                                    |
| `GLOWLAB_PROBE_DEPLOYED_LUMI`   | `1` deliberately enables the preview-build probe of the public live chat route. Sends real AI traffic; not a secret.                                                                |
| `GLOWLAB_PROBE_GEMINI_RECOVERY` | `1` deliberately enables a real revised-responder SDK/catalogue probe from a preview build.                                                                                         |

`GLOWLAB_VERIFY_PROVIDERS=1` deliberately runs the read-only real-provider probe on preview builds only. It never runs on a production build. The temporary branch flag was reset to `0` after verification.

Leave diagnostic flags unset/disabled in normal deployment. Do not print environment contents, decrypt configured keys just to inspect presence, or export webhook destinations. Groq variables now have a server consumer. Existing Make webhook variables and any Klaviyo configuration are not application-side consumers in this source; database hooks/scenarios are configured externally.

## Supabase: inspect before applying anything

The live project already has the commerce schema and historical records. **Do not rerun migrations or seeds merely to demonstrate setup.**

For a separately authorised staging project:

1. Inventory tables, roles, policies, functions, existing integrations and counts using reviewed read-only inspection. `supabase/INSPECT_FIRST.sql` is a starting point, not permission to export data or trigger arguments.
2. Reconcile with existing tables/workflows before choosing the `glowlab` contract. Read the three SQL migrations, `supabase/REVIEW_COMPLETE.sql` and rollback guidance.
3. Present the exact migration plan for approval, back up privately, then apply through the project's reviewed migration process. Nothing auto-migrates at application startup.
4. Expose the reviewed schema in the Supabase Data API while retaining no private anon/authenticated grants. Privileged access stays on the backend; do not loosen RLS to fix a browser error.
5. Set private server variables and test a read. Only seed missing catalogue/policy records **after reconciliation and approval**. `scripts/seed-supabase.js --existing-project-reviewed` is guarded but its flag is not an automated audit. Do not overwrite the current catalogue.
6. Review external hooks. The live audit observed two order INSERT hooks to Make, but those are not recreated by the local migrations. Do not copy their private URLs into SQL or Git.
7. Run approved isolated write tests only with explicit permission. Current scripts can create durable records and trigger external workflows.

## Vercel deployment

Existing production: https://glow-lab-puce.vercel.app/. The original private repository is already connected; this documentation task does not relink it.

- Install: `npm ci`.
- Build: `npm run build` (`vercel.json` sets `node scripts/build-public.js`).
- Output: `public/`, generated from root HTML, CSS, browser JS and images only.
- API: `api/index.js`, with `/api/*` rewritten to the same Express application and server/data files included.
- Function duration: 120 seconds in configuration; check plan/runtime support.
- Production backend: Supabase. Configure stable server-only variables; never `DATA_BACKEND=local`.
- Node engine is now pinned to `22.x`, matching local tests instead of allowing unreviewed major upgrades. The first probe used Vercel-selected Node 26 under the old range; the final preview build checks the pinned runtime.
- New environment values need a new deployment. Secret rotation may invalidate capabilities and guest order ownership; plan it.
- Keep preview protection, domains and existing deployment settings unchanged unless explicitly authorised.

A ready build is not complete verification. Check actual homepage/assets, API rewrites, secure cookies, catalogue reads and privacy. Coordinate staging checkout, model generation and Make/email checks separately. Do not create production orders just to test deployment. The portfolio repository, if later created, should not become a second production source without an explicit migration decision.

## Commands and safe boundaries

```sh
npm test
npm run test:browser
npm run test:browser:providers
python3 -m unittest discover -s tests -p '*_test.py'
npm run build
npm run format:check
npm audit
python3 scripts/audit-publication.py --history
```

There is no standalone ESLint command. Formatting is not a substitute for behavioural testing.

**Not routine safe checks:** `npm run test:live:supabase` already passes `--allow-demo-writes` and can save durable orders/tickets. The seed script writes data. Live Gemini scripts send billable/quota-consuming traffic. Review scripts before running; do not use production variables casually. No production writes or emails were performed. Live AI probes were deliberately executed in a protected preview-build environment using non-customer messages and a read-only catalogue fetch.

## Troubleshooting

| Symptom                              | Check without exposing secrets                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database 503                         | Correct mode/schema/project, service-role permissions and network. Do not replace with a static success catalogue or weaken grants.                                                                     |
| Order not visible in `public` schema | The commerce contract is `glowlab.orders`, with customer JSON and generated projections. Never publish customer rows in an issue.                                                                       |
| Order cannot be looked up            | Same guest browser cookie, reference and email are all required. Email alone cannot recover access.                                                                                                     |
| Lumi 429                             | If Groq fails, the router switches to Gemini; a 429 after fallback means Gemini also failed. Do not add uncontrolled retry loops.                                                                       |
| Lumi 404/model error                 | Check the affected provider's selected model/account availability without logging the key. Groq model failures should fall back; production Gemini override must be reconciled with the tested default. |
| Orders saved but no email            | Review external hooks/scenario, line-item query, provider delivery and status state using [workflows](workflows.md). The application contains no mail sender.                                           |
| Make duplicates                      | Two INSERT hooks were observed. Review both and notification deduplication; do not delete one blindly.                                                                                                  |

## Before an approved production deployment

The existing `GROQ_API_KEY` was production-only. With explicit owner approval it was temporarily given preview scope for the live probes, without reading/changing its value, and then restored to production-only. `GLOWLAB_VERIFY_PROVIDERS` is now `0`. Existing protected probe deployments retain their own deployment-time snapshots; changing project scope is not credential revocation. Do not assume later branch previews can use Groq unless preview access is deliberately re-authorised.

Production's existing `GEMINI_MODEL` override was `gemini-3.5-flash` at inspection. It is not the newly tested fallback. Before merging/promoting, privately review and set the intended fallback override (tested here: `gemini-3.1-flash-lite`) and test the approved preview. No production variable value, database record or promotion was changed for that purpose.

The environment inventory did not show shared Supabase/session configuration for this branch; older branch-specific settings do not automatically apply. Do not claim a ready deployment means a working deployed checkout. Configure an approved staging backend/secret privately and test read-only first. Do not reuse production data or broaden grants merely to complete a portfolio demonstration.
