# GlowLab reliability repair and e-commerce experience audit

**Reviewed 13 November 2026. Status: targeted source repairs completed and tested locally; not deployed or certified production-ready.**

This is an existing fictional store, not a functioning retail business. Payments remain simulated. No production order, customer email, database migration, trigger change, secret change, visibility change, merge or deployment was performed. Existing catalogue IDs, prices, image references, architecture and working approval/idempotency boundaries are preserved.

## 1. Scope and evidence boundaries

- Inspected frontend chat, cart, checkout, confirmation and support; Express routes/security; canonical tool loop; Groq adapter/router; Gemini recovery; SQLite and Supabase adapters; existing migrations, tests and published policy projections.
- First baseline test attempt failed because dependencies were absent in this workspace. Ran `npm ci --ignore-scripts` using the existing lockfile, then established a **50/50 passing baseline** before repair. No new dependency was introduced.
- Reproduced lookup failures using fictional orders in an in-memory SQLite database, not customer records.
- Inspected live Supabase **metadata and aggregate consistency only**, through the connector: real column names/types, unique reference constraint, order/item relationship, RLS and public-role grants. No customer details were retrieved. An EXPLAIN of the proposed narrow reference/email query succeeded against the actual schema. No SQL migration is required or applied.
- Read-only aggregate checks found eight existing orders, no noncanonical stored references/emails, no missing JSON emails, and no differences between `customer_email` and `customer->>'email'`. These counts diagnose consistency, not commercial usage.
- Public production `/api/config` and `/api/ready` returned the older Gemini-only-shaped configuration response and a successful 12-product Supabase read. Missing newer Groq flags **do not establish whether a secret exists or generation works**. The responses demonstrate a version gap, not the repaired code running live.
- No fresh live Groq/Gemini request was made in this repair. All new provider behavior tests use explicitly mocked transports. Prior live-provider evidence is separately documented in [testing](testing.md); it does not certify the new time budgets on production traffic.
- Skin Cupid research used fetched public homepage, collection and product content. The UK address redirected to a US storefront in this research environment, sometimes with mixed-region copy. No competitor account, order, payment or mobile-browser transaction was performed. Do not interpret the comparison as validation of its operational promises.

## 2. Actual failures, diagnosis and repair

### Order lookup: confirmed root causes

The complete original path was:

`chat submit → POST /api/lumi → model selects lookup_order → executeTool → store.order(owner, reference, email) → Supabase orders query → model explanation → browser rendering`.

The direct `/api/orders/lookup` route used the same owner-bound operation.

1. **Original-browser capability was mandatory.** Supabase added `owner_hash = current cookie-derived owner`; SQLite added `owner = current owner`. A correct reference/email pair from another browser was rejected before disclosure. This was intentional original security behavior, not an LLM search failure or a missing relationship. Baseline reproduction: same owner succeeded; fresh owner failed.
2. **Email whitespace was not normalized consistently.** Lookup schemas validated with `z.email()` before trimming, and the adapters lowercased without trimming. The checkout UI trimmed its fields, so an order could save correctly while a later chat/API lookup rejected a space-padded email. Baseline adapter reproduction failed with surrounding spaces. Reference normalization was already partly present at the route boundary; no claim is made that every reference-space input failed originally.
3. **Error classification was lost in the tool loop.** It turned tool exceptions into natural-language error data, then asked the model to continue. Customers could not reliably distinguish unverified input from an unavailable database. The API also returned a much larger order projection than a cross-device status check needs.

### Implemented lookup boundary

- `server/order-lookup.js` validates complete `GL-…` references, trims and uppercases them, trims/lowercases a syntactically valid email, and rejects extra fields. Exact equality is used, never wildcard/partial search or email-only retrieval.
- `verifiedOrder(reference, email)` is a new, separate adapter operation. Supabase filters **both reference and `customer->>email` in one query**. This field exists in the actual schema and matches the canonical checkout projection in all inspected aggregate records.
- Only reference, order/fulfillment/payment states, totals/currency and creation time are returned. No names, addresses, phone, email, internal IDs, items, owner hashes or idempotency data go to cross-session callers or Lumi's lookup tool.
- Wrong email and nonexistent reference return the same HTTP 404, code and message. This does not claim mathematically constant response timing, and syntax errors are intentionally distinguishable from verification failure.
- The direct lookup route and model-driven lookup share one **10-attempt/minute/IP/process** allowance; changing cookies does not reset it. Invalid attempts count. Exceeding it returns 429 and Retry-After. The existing overall API and chat rate limits remain.
- The guard is process-local, like existing limiters. It **does not enforce a global serverless quota across instances**. A shared/durable limiter or explicitly approved infrastructure protection is a P0 prerequisite before treating this as a public production recovery system. No paid service or schema change was added silently.
- Lookup has an 8-second wall-clock deadline. Invalid input, unverified order, DB unavailability and lookup timeout are distinct typed errors. A lookup tool error exits before a model can convert it into a supposed successful lookup.
- **Full receipts remain protected.** The existing owner/reference/email adapter was not weakened. `/api/orders/confirmation` uses it for the original checkout browser. The confirmation page falls back to limited lookup when full confirmation is unavailable in a fresh session; it does not reveal contact details or item lines there.
- Order-linked support is still owner-bound because it is a persistence/action boundary. Status verification does not grant permission to change an order, receive full checkout details or create a linked support action from another session. Customers can submit an unlinked support request; stronger authenticated recovery remains a recommendation.
- Contact now has an accessible direct status form requiring no LLM. Confirmation links to it, and the privacy disclosure distinguishes limited lookup from full receipts/support. No email or reference is placed in a URL.

### Slow/no-response behavior: confirmed code causes and limits of diagnosis

**Confirmed latency amplifiers, not a measured diagnosis of every reported live incident:**

- Original Groq attempt timeout: 20 seconds. Original Gemini attempt timeout: 40 seconds, with two application-level attempts and a nominal 90-second generation budget.
- The installed Gemini SDK defaults to **five total attempts** when retry options are omitted. This is confirmed in the installed SDK's type documentation and implementation (`DEFAULT_RETRY_ATTEMPTS = 5`). Application retries could multiply underlying retries; tests mocking the SDK method did not expose this behavior.
- A typical tool-backed answer needs a first model generation, a tool/database read, then another generation. It is not one provider request per customer message. Up to six rounds and five calls per round were allowed.
- The browser had no fetch deadline and restored controls only when the request settled. A stalled response could leave “thinking” indefinitely from the shopper's perspective.
- Chat initialization waited for unrelated confirmation/policy/catalogue loading. A delayed catalogue read delayed access to chat.
- Request-level identical tool deduplication existed, but different catalogue tools could independently read the same products within one message.
- Conversation history allowed roughly 48,000 JSON characters where whole-turn trimming was possible. Static system instructions are around 8 KB including declarations before tool results in the synthetic sample. There is no evidence that prompt length alone explains the reported live incident.

**Repairs:**

- 8-second per-attempt Groq/Gemini deadlines, with abort signals and an independent wall-clock guard. Gemini SDK attempts explicitly set to **one**; the application alone controls its one transient retry. Auth/model/request/quota errors are not retried within Gemini; primary-provider technical failures may still fail over as previously authorized.
- A **35-second whole-assistant wall-clock budget**, including tool waiting, with a 40-second browser deadline. Other browser API calls have a 15-second deadline. Aborting client waiting does not guarantee a provider stops server-side computation or billing.
- Sticky Groq→Gemini fallback, same context/tools, no tool execution inside generation retry. No duplicate HTTP submission was added. The UI's existing busy guard and explicit cart/support approvals remain.
- Request-scoped products/policies promise caching; distinct catalogue tools reuse one DB read, without sharing stale data across customers, messages or checkout.
- Whole-turn history retention target reduced to 24,000 JSON characters/24 entries where possible. The latest complete tool turn is preserved rather than corrupting tool-call pairing; this is not an unconditional hard token-size guarantee.
- Chat initializes after public config rather than waiting for the catalogue. Loading changes after eight seconds; timeout/interruption restores the message and send/reset controls for an explicit retry, never an automatic mutation retry.
- Sanitized provider timing/outcome monitoring and tool duration/success observations. Browser receives the response provider label, explicit fallback notice and structured verified-order data. It shows an authoritative verification summary separate from generated wording; it also flags tool failures. No credentials, raw provider errors, tool arguments or personal data are added to timing logs.
- Exact legacy delivery/returns/refunds/cancellation/payment policy text is projected consistently server-side. Lumi no longer receives historical illustrative delivery promises or a blanket denial of acknowledgement email for those exact stored policies. Future owner-authored policy content is not overwritten and the database is unchanged.

**Not established:** current live provider latency, model override validity, serverless cold-start timing, real database HTTP latency, intermittent internet behavior, production error frequency, or universal model factual/medical accuracy. Production was not redeployed. No invented p50/p95 commercial performance claim is made.

## 3. Measured latency and request counts

Evidence: [sanitized measurements](evidence/reliability-latency.json). Reproduce the after-repair local synthetic benchmark with `node scripts/benchmark-reliability.mjs`.

| Measurement | Before | After | Interpretation |
| --- | --- | --- | --- |
| Product/tool explanation with fixed 80 ms mocked generation delay | 165 ms, one baseline sample, two generations | 162.82 ms median, five samples, two generations | Essentially the same artificial two-generation cost. **Not evidence of a real-provider speedup.** |
| Direct verified lookup | No cross-session success in original flow | 0.50 ms median / 1.79 ms max, five local service samples | SQLite/service timing, not network or live Supabase latency. Zero LLM calls. |
| Lumi verified lookup with the same mocked 80 ms delay | Not separately timed before repair | 162.06 ms median, five samples, two generations | Demonstrates why the direct form avoids model overhead; not live latency. |
| Never-settling primary transport | No fresh before-repair wall-clock hang test | Primary aborted at the 8-second cap and fallback answered in the executed regression test | Actual wall-clock fault-injection test, not an external provider test. |
| Distinct catalogue tools in one message | Separate reads in source path | One read, asserted by executed test | Reduced duplicate DB work, not a claimed measured network saving. |
| Configured assistant budget | 90-second generation budget; no browser deadline | 35-second whole-request guard / 40-second browser guard | Configured safety ceilings, not observed production response times. |

An 8-second provider cap may be too aggressive for a slow but valid reasoning response; evaluate provider-specific success/timeout percentiles in approved staging before rollout. No model was silently changed for this repair.

## 4. Customer-visible error contract

| Outcome | API/result | Customer behavior |
| --- | --- | --- |
| Order verified | 200 + allowlisted order summary | Shows actual status/totals and demo warning |
| Reference/email not verified | 404 `ORDER_NOT_VERIFIED` | Same generic message for nonexistent reference and wrong email |
| Invalid input | 400 `ORDER_LOOKUP_INVALID` | Requests complete reference and valid email; no DB query |
| DB unavailable | 503 database category | Explicitly says no order status was verified; no raw SQL/key/error |
| Lookup timeout | 504 `ORDER_LOOKUP_TIMEOUT` | Explicit retry guidance, no false verification |
| Excess lookup attempts | 429 `ORDER_LOOKUP_LIMIT` | Wait a minute; direct/tool allowance shared per instance |
| Provider timeout | `LLM_TIMEOUT` / non-success | Friendly retry/contact alternative; controls restored |
| Provider failure | Sanitized `LLM_UNAVAILABLE` or existing Gemini auth/model/quota category | No invented successful action; provider monitoring preserves failure |
| Other tool failure | `toolFailures` plus tool error data | UI warns store information was not successfully retrieved |
| Empty/unfinished generation | `LLM_EMPTY_RESPONSE` / `LLM_STEP_LIMIT` | Explicit non-success rather than an endless spinner |
| Browser interruption/deadline | Client error with retryable message | Original message restored; no automatic resend or duplicate checkout |

The assistant is still generative: prompt delivery and mock-tool tests cannot certify every natural-language answer. Structured lookup data and the provider-independent status form are the trusted status surfaces. A failure to generate an explanation is not proof that a prior checkout failed; checkout retry keys remain stable for unchanged details.

## 5. Executed tests and actual outcomes

Final run after repairs:

| Command/check | Actual result | Scope |
| --- | --- | --- |
| `npm test` | **67 passed, 0 failed** | Existing 50 plus 17 added cases; real local API/storage, adapter transport mocks, PGlite schema/transactions and provider faults |
| `npm run test:browser` | **56 browser groups passed** | Nine pages/viewports, catalogue search/filter/details, empty/error states, cart quantity/removal/totals, validation, checkout persistence, confirmation reload, Lumi approvals and recovery |
| `npm run test:browser:providers` | **3 scenarios passed** | Primary/fallback/dual-failure delivered through real frontend/HTTP; providers mocked |
| `npm run test:browser:reliability` | **8 groups passed** | 1440px and 390px independent-session status, wrong email/reference equivalence, native validation, interrupted request and clock-driven slow/timeout control recovery |
| Python publication-tool tests | **4 passed** | Blueprint sanitizer and image metadata tool regression |
| `npm run format:check` | Passed | Formatting, not a substitute for a linter |
| `npm run build` with diagnostics disabled | Passed | Local public packaging, not deployed production verification |
| Full / production npm audits | **0 known vulnerabilities reported** | Dependency advisories at execution time, not a universal security guarantee |
| `git diff --check` | Passed | Whitespace consistency |
| Publication pattern scan / local doc links | 136 publishable working files and 25 built assets: zero findings; 24 checked local Markdown targets: zero errors | Heuristic credential rules, not a proof of universal safety |
| Live connector schema/aggregate/EXPLAIN reads | Succeeded | No customer output or writes; no live checkout or key retrieval |

Added order cases include valid matching pair, whitespace/case normalization, wrong email, nonexistent reference, invalid/extra input, fresh session, DB failure, bounded DB wait, repeated attempts with fresh cookies, shared chat/direct guard, narrow Supabase query, original-browser full receipt and denied cross-session full receipt. Added assistant cases include actual catalogue/routine/policy tools under a mock model, verified lookup, failed verification stopping before a second model call, request-scoped read reuse, hanging-primary fallback, dual failure and interruption. Existing suites cover idempotent/atomic checkout, stock and no mutation on Add to Cart.

Failures encountered were not hidden: the first test run lacked dependencies; an intermediate Zod chain error was fixed; a browser regression caught confirmation expecting item lines from the new narrow projection and led to the separate owner-bound confirmation path. Parallel Chromium extraction caused ETXTBSY, and single-process context churn closed the new browser test. Browser suites were then run sequentially; the new suite reuses a context with cleared cookies. All final commands above passed. These transient failures are not reported as remaining application failures.

Screenshots for local inspection are in ignored `test-results/`, including reliability Contact pages at desktop/mobile sizes; they are not customer evidence or new public marketing assets.

## 6. Skin Cupid comparison: functionality, trust and merchandising

### Research sources and limitations

- **S1:** [Skin Cupid homepage](https://www.skincupid.co.uk/) — fetched homepage/bestsellers, collections, trust/review content, education and loyalty entry points. Redirected to `.us` in this environment.
- **S2:** [All products](https://www.skincupid.co.uk/collections/all) — fetched product cards, sort/filter entry point, sort options, brands/prices/ratings and size-option examples. Exact interactive filter facets were not fully exercised.
- **S3:** [Representative ANUA product page](https://www.skincupid.co.uk/products/anua-heartleaf-pore-control-cleansing-oil-200ml) — fetched gallery, quantity/add controls, stock/dispatch copy, ingredients, usage/FAQs, reviews and loyalty information. These are retailer-presented claims, not independently verified efficacy or fulfillment.
- **S4:** [Attempted delivery/returns route](https://www.skincupid.co.uk/pages/delivery-returns) — redirected and returned page-not-found content. Therefore no precise competitor returns policy is inferred from this route.

No images, branding, copy, ingredient claims, ratings or layout were copied. Priorities: **P0** = reliability/security prerequisite; **P1** = material trust or purchase-decision improvement; **P2** = useful convenience; **P3** = defer until there is an operational need.

| Feature | Skin Cupid observed implementation | GlowLab implementation | Gap / value for GlowLab | Priority | Recommended improvement |
| --- | --- | --- | --- | --- | --- |
| First impression / identity | Curated beauty merchandising and bestseller collections (S1) | Coherent cream/sage storefront, category-led hero and Lumi | Fictional/demo status must remain unmistakable before an order, not just imply a retail operation | P1 | Keep current design; use concise consistent demonstration disclosure, not fake commercial proof |
| Navigation / categories | Multiple linked collections, category shopping and brand links (S1–S3) | Home, Products, About, FAQ, Contact, Cart; six category filters | Adequate for 12 products; large mega-menu is unnecessary | P2 | Preserve small-store navigation; improve current category/deep-link clarity if testing shows confusion |
| Search / sorting | Collection Sort & Filter and price/newest/rating options (S2) | Substring search across name/brand/skin-type/category plus category buttons | No price sort, budget filter or dedicated brand/skin-type facet | P2 | Add price sort and brand/skin-type filters only from existing metadata; do not invent suitability |
| Recommendations | Bestseller/collection merchandising and linked ingredient shopping (S1, S3) | Tool-grounded Lumi search and basic routine builder | No non-chat related-products module; routine preferences are not deeply ranked | P2 | Offer small same-category alternatives using actual data; explain why, no popularity claims without evidence |
| Mobile convenience | Mobile promotional assets and shopping controls appear in fetched source; actual competitor mobile interaction untested | Executed multi-viewport tests, responsive menu/modal/cart/chat; new status form checked at 390px | Real-device keyboard/screen-reader coverage remains incomplete | P1 | Test iOS/Android devices and assistive tech; keep keyboard focus/status behavior |
| Promotions | Promotional banners, sale prices and gift offers (S1, S3) | No live promotional engine or verified discount offers | Not a defect for a demo; fake urgency would reduce credibility | P3 | Do not add discounts, crossed-out prices or countdowns without real configured rules |
| Trust signals | Retailer-presented Trustpilot links, reviews and authenticity messaging (S1, S3) | Explicit demo/no-payment/no-authenticity-certification disclosures; no fabricated reviews | Cannot truthfully imitate a trading retailer's trust proof | P1 | Earn trust through accurate provenance, product-detail sources, privacy and clear support limits |
| Delivery visibility | Product page presents region-specific dispatch/threshold information (S3); region content varies | Zero demo fee; no dispatch/tracking, clear checkout and policy wording | No real shipping-rate/threshold service—and none should be implied | P1 | Keep no-dispatch wording consistent; implement real zones/rates only if an operational launch is separately approved |
| Returns / refund clarity | Product FAQ/terms surfaces observed; exact returns policy not verified (S3, S4) | FAQ, policies and saved support requests; no physical returns or monetary refund | Demo support must not imply a return authorization or refund execution | P1 | Clearly distinguish recording a request from approving or processing it |
| Newsletter / loyalty | Email signup, points/rewards/referrals and account entry points (S1) | No newsletter or loyalty collection | Not needed without real fulfillment, consent handling or a repeat-purchase business | P3 | Defer; any future signup needs consent/unsubscribe/storage design, not a decorative dead form |
| Names, brands and prices | Product cards and PDPs show brand, name, size and prices (S2, S3) | All 12 original IDs/names/brands/prices retained; NGN pricing | No verified source-update process for catalogue enrichment | P1 | Keep authoritative prices and document who verifies future product metadata |
| Product imagery | Multiple pack/texture/use images (S3) | One inherited image per product; images load in browser tests | Limited angle/packaging context and inconsistent original framing | P2 | Add only owner-permitted product imagery; standardize crop/background without copying competitor assets |
| Descriptions | Longer product/ingredient context and concern labels (S3) | Deliberately minimal catalogue descriptions, unverified details withheld | Biggest decision-confidence gap; sparse detail limits useful recommendations | P1 | Obtain manufacturer/packaging-backed descriptions, directions, size and provenance before adding claims |
| Ingredients / usage / skin needs | Ingredients, how-to-use, skin types and concerns on PDP (S3) | Skin-type shopping labels exist; ingredients/usage gated by details_verified; size often not listed | Cannot safely assess exclusions, sensitivities or compatibility from missing data | P1 | Populate verified fields with dated sources; display unknowns, never infer formulations from brand names |
| Product variants | Size-option examples in fetched merchandising (S1–S3) | No variant model or selectors; 12 fixed catalogue records | Adding pretend variants would create price/stock confusion | P3 | Introduce variants only when supported by actual catalogue/stock requirements |
| Availability / stock | In-stock/sold-out and availability reminder controls (S3) | Available/unavailable state; null stock is untracked, not a quantity claim | No reservation, restock alert or fulfillment operations | P1 for real retail | Preserve current honest availability; require operational stock synchronization before real sales |
| Reviews / ratings | Retailer-presented ratings, counts, review content and submission UI (S2, S3) | None | Missing social proof is preferable to fabricated reviews | P3 | Add only genuine, permissioned reviews with moderation/verification if the store becomes real |
| Quantity / Add to Cart | PDP quantity controls and Add to Cart (S3) | Product card/modal adds one; cart adjusts/removes quantities up to validated limits | No PDP quantity selector; current cart controls work | P2 | Optional PDP quantity selector if it reduces repeated taps; preserve server quantity/stock limits |
| Product details / sharing | Dedicated product URL and content sections (S3) | Query-linked accessible modal, focus return and missing-product message | Less rich SEO/indexable product content | P2 | Improve shareable product detail route/content progressively; do not rebuild for this repair |
| Cart / total visibility | Bag, empty state, subtotal and delivery-at-checkout copy (S1, S3) | Persistent cart, empty/recovery states, quantity/removal, demo shipping and authoritative server totals | No live shipping/tax calculation; not appropriate to imply it | P1 | Preserve pricing authority and demo total clarity; test real regional pricing only under new scope |
| Checkout / payment | Checkout button and payment-method presentation observed, not transaction-tested (S1, S3) | Validated contact form, explicit simulation, atomic order/item persistence and owner-bound idempotency | Not a payment integration; no receipt, capture or refund provider | P0 before real sales | Keep simulation explicit; a real payment launch needs separate payment/webhook/security scope |
| Confirmation / reference | Account/orders interfaces appear in fetched content; actual purchase confirmation untested (S1) | Persisted random reference, full original-session receipt, separate states and limited cross-session recovery | Original lookup previously failed outside the checkout browser | P0 | **Implemented:** exact reference/email status verification, direct form, preserved owner-bound full receipt |
| Confirmation email | Delivery/communications outcomes not transaction-tested on competitor | Existing Make path; owner reports a successful email test; export/live reconciliation remains open | A UI order success is not proof of email delivery, deduplication or retry safety | P1 | Preserve working automation; map both hooks/revisions, claim uniqueness and Gmail error handling in approved staging |
| Order status / recovery | Account/login and Your Orders surfaces observed, not authenticated/tested (S1) | Limited verified status from any browser; no shipping events or real dispatch | No authenticated account/OTP recovery; full support link remains session-bound | P1 | Add stronger recovery only when needed; first add distributed throttling and staging verification |
| AI product/policy advice | No competitor AI behavior was tested | Five model-selected server tools, verified catalogue boundaries, approval-based cart/tickets | Generative factual behavior not universally certified; sparse product data limits advice | P1 | Adversarial/live staging checks; show sources/unknowns and preserve medical limitations |
| Support escalation | Product FAQs, account/help surfaces observed; actual response SLA unverified | Contact saves tickets; Lumi prepares explicit review drafts; no guaranteed human/email response | Saved ticket is not staffed escalation | P1 | State hours/channel/response promise only once staffing and notification evidence exist |
| Privacy / credential safety | Account and policy links observed; no competitor security certification inferred | Server-only privileged credentials, RLS, origin/JSON checks, no-store responses, signed owner-bound actions | Shared-device drafts/transcripts are readable; credentials/retained uploads need owner handling | P0 | Rotate the identified uploaded key safely, complete artifact review; plan retention and durable abuse controls |

### Overall retail assessment

GlowLab is a credible **commerce demonstration** when it makes its boundaries explicit. Discovery, cart editing, authoritative totals, simulated order persistence and references are implemented. It is **not ready to accept real money**: payment processing, fulfillment, operational returns, reliable notification reconciliation, globally effective abuse controls, verified product data and staffed support are separate requirements. A wholesale visual redesign or loyalty program would not address those blockers.

## 7. Files changed for this repair

This workspace already contained earlier publication/provider preparation changes when the task began, including archived docs and metadata-only image edits. Those are not claimed as newly made by this repair; no reset, cleanup commit or history rewrite was used to discard them.

| Files | Why |
| --- | --- |
| `server/order-lookup.js` (new) | Shared validation, safe projection, typed lookup errors/deadline, shared bounded attempt guard |
| `server/request-deadline.js` (new) | Abort-aware wall-clock operation guard |
| `server/supabase-store.js`, `server/local-store.js` | Separate deterministic reference/email verification without weakening original owner-bound access |
| `server/app.js` | Shared direct/tool lookup allowance, limited lookup route, owner-bound confirmation route, Retry-After |
| `server/tools.js` | Deterministic verified lookup, no session-bound error instruction or PII projection |
| `server/lumi.js` | Whole-request deadline, safe lookup-error propagation, read reuse, structured order/provider/tool-failure results, tool timing and smaller history target |
| `server/llm-router.js`, `server/groq.js`, `server/gemini-request.js` | Bounded attempts, abort propagation, explicit SDK retry control and provider timing |
| `server/validation.js` | Checkout email whitespace/case normalization before persistence |
| `server/lumi-system-prompt.js`, `server/policy-copy.js`, `js/storefront-copy.js` | Accurate cross-session verification and demo-policy/privacy boundaries |
| `js/script.js`, `contact.html` | Direct status UI, earlier chat initialization, owner receipt/limited recovery, fetch/loading/timeout/retry states, provider/verification display |
| `tests/reliability.test.js`, `tests/browser-reliability.mjs` (new) | Explicit lookup, provider, security, caching, mobile and timeout regression coverage |
| `tests/backend.test.js`, `tests/gemini-request.test.js` | Updated intentional lookup contract, full receipt boundary and bounded explicit-retry assertions |
| `scripts/benchmark-reliability.mjs` (new) | Reproducible local synthetic benchmark, never uses production integrations |
| `package.json` | Adds reliability-browser script; no new dependency |
| `README.md`, `docs/architecture.md`, `docs/workflows.md`, `docs/portfolio-case-study.md` | Replace outdated session-only/timeout descriptions; link actual current evidence |
| This report; `docs/evidence/reliability-latency.json` | Diagnosis, comparison, measurements and explicit limitations |

**Database/schema changes: none.** Existing migrations were inspected/tested locally, not reapplied. No live hook, table, key, policy record or order was changed.

## 8. Prioritized remaining work and rollout gate

### P0 — before public multi-instance recovery or real transactions

1. Review this changed guest-access model and its narrow projection; deploy only with explicit approval after an approved staging test. Use distributed/durable attempt enforcement before relying on it across serverless instances. No paid solution has been selected.
2. Coordinate the affected privileged Supabase key replacement/revocation and dependent Make/backend updates. Removing the uploaded value is not revocation. Never paste it into a ticket, report or frontend.
3. Confirm current deployment revision, model overrides, provider health and staging database/session configuration privately. Measure actual provider/DB/tool percentiles, cold starts and timeouts before deciding final budgets. Current production does not contain these source repairs.
4. Before taking real money: approved payment-provider design, verified payment callbacks/idempotency, fulfillment/stock/returns operations and legal/privacy/support readiness. Not part of this demo repair.

### P1 — customer confidence and post-purchase reliability

5. Verify product descriptions, sizes, ingredients and usage from appropriate sources; attach provenance and preserve uncertainty until verified.
6. Reconcile the actual working Make revision with both preserved INSERT hooks, notification claim/status contract, item-name mapping and Gmail failure handling. Owner-tested successful email is acknowledged; universal delivery and exactly-once processing are not asserted. No production email test was sent here.
7. Plan authenticated recovery or owner-approved support association across devices if full receipt/action recovery is needed. Status verification alone must not authorize mutations.
8. Perform live-provider staging tests for product facts, order questions, failure recovery and medical boundaries, plus real-device accessibility. Mocks prove plumbing, not model behavior.
9. Define retention/deletion/shared-device behavior for browser chat and drafts. Signed history is readable, not encrypted.

### P2/P3 — only after reliability and real data

10. Price sorting/budget and brand/skin-type filters, factual related products, consistent imagery and optional product quantity selector.
11. Defer loyalty, newsletter, review collection, advanced recommendations and variant infrastructure until real operational needs and consent/data sources exist.

## 9. Completion statement and unresolved failures

**Completed:** reproducible local diagnosis, targeted repairs, fresh-session minimal lookup, protected full receipts, bounded provider/browser waits, explicit failure handling, executed regression tests, read-only real-schema validation, synthetic latency evidence and retailer comparison.

**Not completed or claimed:** production repair rollout, fresh real-provider or live-Supabase checkout test, current Make run reconciliation, global serverless rate limiting, universal model correctness, real payments/delivery, or clearance of inaccessible GitHub issue/Actions artifacts. No automatic publication was performed. Build/test success is not production readiness.
