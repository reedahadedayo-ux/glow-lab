# Testing and verification

[README](../README.md) · [Architecture](architecture.md) · [Workflow audit](workflows.md)

**Fresh execution: 13 November 2026.** Scope: the existing storefront/runtime plus documentation/publication checks. No production order, ticket, customer email or AI request was generated for this audit. Passing a local build is not a production-readiness claim.

## Results actually observed

| Command / check                      | Result                                                                                                                           | Evidence boundary                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm ci`                             | 139 packages installed; audit initially reported 0 vulnerabilities.                                                              | Dependency installation, not application behaviour.                                                              |
| `npm test`                           | **40 passed, 0 failed**.                                                                                                         | Node tests; local SQLite/PGlite and explicitly mocked external transports.                                       |
| `npm run test:browser`               | **56 groups passed**; no unexpected page/console errors.                                                                         | Local Express/SQLite; mock Gemini transport; 1440px, 768px and 390px.                                            |
| `npm run build`                      | Passed.                                                                                                                          | Public asset build; diagnostic flags unset. No live-provider verification implied.                               |
| `npm run format:check`               | Passed.                                                                                                                          | Existing Prettier coverage; not ESLint/static type checking. No separate lint script exists.                     |
| `npm audit` / `npm audit --omit=dev` | **0 reported vulnerabilities** at the check.                                                                                     | Registry advisory snapshot, not a complete security assessment.                                                  |
| Heuristic publication scan           | Initial tracked tree and all 133 unique ancestor blobs: no pattern findings. Re-run after staging final docs.                    | Explicit credential/webhook/private-file rules; not comprehensive detection.                                     |
| `detect-secrets` offline scan        | Current tracked snapshot: five test-canary flags. All 22 full ancestor snapshots: 56 flags at the same five test-file locations. | Reviewed as intentional test-only secrets, not real credentials. No online credential validation.                |
| Production `GET /api/ready`          | `ready=true`, `database=supabase`, `catalogueCount=12`, `geminiConfigured=true`.                                                 | Real catalogue read; the Gemini flag is configuration presence only.                                             |
| Supabase trigger/column metadata     | Two enabled order AFTER INSERT Make-destination HTTP hooks; neither UPDATE/DELETE. No order notification-status column.          | Read-only configuration, no customer rows or webhook values included in docs.                                    |
| Make scenario/email tests            | **Not performed / blocked by missing scenario access/export.**                                                                   | No claim of line-item email, inbox placement, retry safety or status update.                                     |
| Repository creation                  | **Blocked** by GitHub integration permission (`createRepository`).                                                               | Authentication to the existing repository succeeds. Preferred new repository does not exist from this operation. |

The final prepared tree passed the publication helper (114 tracked files / 133 historical blobs / zero findings), all 79 local Markdown targets/fragments, and staged whitespace checks. The dedicated scanner still flagged only the same five test canaries. A final re-run of the 40 automated tests, build and formatter also passed. The inactive CI template is saved at `docs/ci-workflow.example.yml`. GitHub rejected activation because the integration lacks `workflows` permission; no remote Actions success is claimed.

## Automated suite coverage

- `backend.test.js`: catalogue integrity, authoritative prices/totals, customer/item snapshots, idempotent and concurrent retries, stock, private order lookup, support approval/persistence, CSRF/content rules, unavailable storage, Gemini orchestration with injected transport, signed-history errors.
- `schema.test.js`: local PostgreSQL-compatible migration/constraint/function behaviour and additive customer/fulfilment/totals correction. This is **PGlite**, not live Supabase.
- `supabase-adapter.test.js`: real SDK adapter with mocked HTTP; schema/project/credential validation, owner scoping, RPC inputs, sanitized database faults and no false catalogue fallback.
- `gemini-security.test.js`: frontend secret boundary, recursive redaction, sanitized errors/logs, model text/history key suppression using explicit canaries.
- `gemini-request.test.js`: bounded transient generation recovery, non-retryable categories, shared deadline and no tool replay after generation retry.
- `lumi-system-prompt.test.js`: prompt rules/wiring, tool-result rounds and signed history with mock transport. Not proof of clinical correctness or model compliance in production.
- `storefront-copy.test.js`: exact-only legacy text adaptation, future configured text pass-through, truthful payment/state labels, missing-detail slots and simulation consent.

## Browser coverage and screenshots

The browser harness uses the actual local API/storage implementation and injected Gemini replies only for reproducibility. It checks:

- All nine pages at desktop/tablet/mobile widths; image loading, horizontal overflow, navigation, legacy absence and local links.
- All twelve direct product-detail URLs and labels for unavailable size/ingredients/directions.
- Search/category filters, modal keyboard closing, cart addition/quantity/removal/reload and explicitly approved AI cart selections.
- Checkout native validation, simulation consent, saved order reference, customer snapshot persistence and reload/lookup at desktop and touch widths.
- Support request save, AI draft confirmation and privacy/ownership boundaries.
- FAQ controls and deliberate 503 catalogue recovery; checkout cannot claim success during failure.

Expanded exhaustive navigation uses separate local app instances per viewport to stay below the real per-instance limiter. Production limits were not weakened to make tests pass. Most screenshots are ignored in `test-results/`. The selected documentation product screenshot contains only catalogue information; it is labelled as a **local test capture**, not live AI/email evidence.

## Historical evidence vs fresh verification

Archived reports contain earlier connector SQL persistence checks, live SDK/catalogue probes, gateway 504s and public chat 429 quota failures. They are dated observations, not fresh certification. Current live AI generation was deliberately not retried during a documentation task. Previously observed Supabase checkout capability is not a substitute for a new production write test, and none is claimed here.

## Outstanding acceptance gates

| Area                       | Required test before claiming operational success                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current Gemini             | Real normal question, model-selected search/routine, contextual follow-up and safe failure; confirm current account model/quota privately.                                                                                                     |
| Groq/fallback              | Implement first, then verify actual Groq default calls, simulated technical failure to Gemini, shared context/tool results, no duplicate actions and dual-provider failure. No such tests pass in this revision because it is not implemented. |
| Direct checkout navigation | Implement first, then verify single addition, double-click handling, preserved cart/back/reload and checkout-side quantity/removal at touch/desktop.                                                                                           |
| Central checkout           | Explicitly approved staging HTTP save + owner lookup + repeat/concurrent retry, then inspect saved snapshots without exposing customer data.                                                                                                   |
| Make                       | Sanitised blueprint, intended hook selection, event/order/item mapping, aggregation, authentication, retry/deduplication and state contract.                                                                                                   |
| Email                      | Controlled recipient and explicit permission; every product line, quantities/prices/totals, truthful simulation wording, accepted/sent/failure evidence, bounce and spam/inbox review.                                                         |
| Notification status        | Identify actual external state or review a migration. Verify atomic claim, no double send, failure handling and reconciliation after ambiguous timeout.                                                                                        |
| Public release             | Final history/staged-source secret scan, owner privacy/asset-rights/licence review and explicit visibility approval.                                                                                                                           |

## Commands to avoid accidentally running on production

`npm run test:live:supabase` includes `--allow-demo-writes` and can create durable orders/tickets and fire external hooks. Seed and migration scripts change data/schema. Preview live-AI diagnostics send real quota-consuming requests. Review the scripts and obtain explicit staging permission before using them. Do not use a production order to manufacture a portfolio outcome.
