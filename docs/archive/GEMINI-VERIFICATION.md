> **Historical implementation record.** This is not the current project status. Start with the [current README](../../README.md), [architecture](../architecture.md) and [workflow audit](../workflows.md). Later deployments and database configuration may supersede statements below.

# Gemini integration verification — 13 November 2026

## Server boundary and secret handling

- `server/runtime.js` defaults its environment parameter to `process.env` and passes it into Express. `server/lumi.js` reads `env.GEMINI_API_KEY` and constructs `GoogleGenAI` from the official `@google/genai` SDK. Lockfile-resolved SDK version: **1.52.0**.
- The browser only POSTs messages/history to same-origin `/api/lumi`. There is no Google API request, SDK import, Gemini key or public-key environment variable in the frontend.
- Static build copies only the page allowlist plus CSS, JS and local imagery; no environment interpolation or server module is copied into `public/`.
- API configuration exposes only a boolean, not the key. Added defensive redaction for configured backend secrets in API JSON, model text, signed history and diagnostic logs. Raw SDK exceptions are never returned/logged.
- Local canary tests cover model echoes, signed history, API errors, logs and recursive secret redaction. These security tests use synthetic canaries/mocks; they are **not** live Gemini evidence.
- A Google API key pattern scan of all 11 then-reachable local Git commits found no keys. The key itself was never retrieved/decrypted from Vercel, printed, placed in source/Git, or copied into the sandbox.
- Vercel's live build scanned all **24 public output files** against the actual configured secret and found **no key in public output**. Observed sanitized verification/build logs contain no secret value. This is not an exhaustive audit of all historical Vercel runtime logs.

## Environment correction

Vercel metadata originally scoped the user-added sensitive `GEMINI_API_KEY` to Production only. Updated its target metadata to Production + Preview, preserving the stored value without decrypting it. No production deployment or domain promotion occurred.

Branch-scoped `GLOWLAB_VERIFY_LIVE=1` explicitly enables read-only live verification in preview builds only. It never runs on production builds. Failed verification blocks that new preview build rather than claiming success or silently switching to mocks.

## Confirmed live evidence so far

Vercel build `dpl_GHxaVvjyzjsorvfbZYPy2UmEo7kC` on revision `5eb812c`:

- Real official SDK request with configured secret: HTTP **404** for `gemini-2.5-flash`.
- Actual Supabase HTTPS catalogue read: **PASS**, 12 records with exact original ID/price/image tuple matches.
- Actual public-output secret scan: **PASS**, 24 files.
- Lumi search/routine: **BLOCKED**, no successful Gemini inference yet. Build correctly failed.

Discovery build `dpl_AbX1hreSgHZTLGqUt4pidfohMa1a` on revision `65120a6`:

- Reproduced 404 for `gemini-2.5-flash` (even though the model listing still advertised it).
- Successfully called Google's model listing with the stored key; response advertised `models/gemini-3.5-flash` among generative models.
- Selected **gemini-3.5-flash** via a branch-scoped preview `GEMINI_MODEL` variable. No production model setting was changed.

## Completed live run — PASS

Deployment `dpl_7BP2WMGLhV45R6Ej38T1YCERUBcg`, preview URL:
https://glow-4yvbc5x4g-reedahadedayo-uxs-projects.vercel.app

Vercel confirmed this deployment **READY / STAGED / preview**, revision `65120a64319cfcebe3e6d2434ef7bd17f47b3807`.

This run used `gemini-3.5-flash` and executed an actual direct SDK request, an actual Supabase catalogue read, then real Express `/api/lumi` search and routine requests using model-decided tool calls. Only sanitized evidence is logged: model, status/codes, tool names, catalogue read counts, verified public product IDs/prices and routine total. No raw key/model text, customer details or history tokens are logged. No orders/tickets/cart mutations are performed.

The harness runs on the Vercel build host so the sandbox egress restriction and preview login do not require bypassing access protection. It tests the real server handler with real external services, not the public deployment's authentication, edge rewrites or cold-start behavior. Public Vercel browser acceptance remains separate.

Completed sanitized live record (2026-11-13T10:23:56.012Z, logged at 10:24:32.126Z):

| Check                                     | Actual result                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Public output scan against configured key | PASS, 24 files, no key found                                                                 |
| Official SDK generateContent              | PASS, real nonempty model response                                                           |
| Supabase catalogue HTTPS                  | PASS, all 12 original tuples match                                                           |
| Server configuration API                  | PASS, configured boolean only, no key returned                                               |
| Real Lumi product search over HTTP        | PASS, model requested search_products, one real catalogue read, cerave-foaming at NGN 14,500 |
| Real Lumi routine over HTTP               | PASS, model requested build_skincare_routine, one real catalogue read, NGN 43,300 total      |

Routine products: cerave-foaming (14,500), neutrogena-hydro (12,500), eucerin-oil-control (16,300). Product IDs/prices/images were checked against the actual Supabase records. No cart mutation occurred. Model text was nonempty but deliberately not logged.

**No remaining error in these live SDK/catalogue/search/routine checks.** Earlier model 404 was resolved for this preview by explicit `GEMINI_MODEL=gemini-3.5-flash`. The source fallback/example still names gemini-2.5-flash: any future production release must explicitly configure the verified model; production has not been changed or promoted.

Disabled the branch-scoped one-time verification flag (`GLOWLAB_VERIFY_LIVE=0`) after success to avoid unintended model requests on future builds. The successful deployment retains its original build-time flag, but the application runtime never invokes that build check on customer requests.

Local regression suite: **28 tests pass; 38 browser journey/page/viewport groups pass**. Those remain explicitly local/mock tests and are separate from the successful real Vercel integration evidence above.

Remaining boundary: authenticated public-preview browser/edge/cold-start acceptance and full live checkout/support are not established by this build-host test. Preview authentication was left enabled. No production deployment or domain change was performed.
