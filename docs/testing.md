# Verification and test evidence

[README](../README.md) · [Release audit](release-audit.md) · [Make review](workflows.md)

**Updated 13 November 2026.** Mocked transport tests, live calls, owner testimony and static blueprint evidence are deliberately separate. A successful build is not production readiness.

## Results

| Check                            | Observed result                                                                                                                                                         | Boundary                                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                       | **50 pass, 0 fail**.                                                                                                                                                    | Local Node tests; SQLite/PGlite; mocked external transport where applicable.                                                                                           |
| `npm run test:browser`           | **56 journey/page/viewport groups pass**; no unexpected page/console errors.                                                                                            | Actual local Express/SQLite, injected Gemini test transport; 1440px/768px/390px.                                                                                       |
| `npm run test:browser:providers` | **3 scenarios pass**: Groq-primary response, Gemini fallback, both-provider error.                                                                                      | Actual browser/UI/HTTP/router at 390px; provider transports explicitly mocked. Error message displayed, input usable, keyboard close control and viewport fit checked. |
| Python publication tools         | **4 tests pass**.                                                                                                                                                       | Sanitizer removes config/bindings/metadata, preserves connected mappings/error handlers and checks template JSON topology. Not a Make import test.                     |
| Build / formatting               | Passed locally; documentation formatting checked separately.                                                                                                            | No standalone JavaScript lint script exists.                                                                                                                           |
| Dependency audit                 | Both full and production-only `npm audit`: **0 reported vulnerabilities** at check time.                                                                                | Advisory snapshot, not a security certification.                                                                                                                       |
| Read-only live Supabase metadata | Six commerce tables have RLS; no anon/authenticated table grants; commerce RPCs invoker-security/empty search path/service-role execution only for the inspected roles. | No customer rows exported; no SQL writes.                                                                                                                              |
| Order notifications              | Owner reports a successful email test; actual v1 blueprint inspected.                                                                                                   | No fresh audit-triggered mail/order. Current schema and blueprint mismatches remain documented.                                                                        |
| Publication helpers              | Tracked-tree/history heuristic and local Markdown target checks run before final handoff.                                                                               | Scope and limitations in [security review](security-review.md); scanner output is evidence, not proof of universal absence of secrets.                                 |

## Live Groq/Gemini evidence

[Sanitised results](evidence/provider-probes.json) retain only provider/model/outcome/status and contract flags—not keys, raw customer data or model answers. Vercel build-log events were read specifically to verify these probes.

| Requirement                  | Actual evidence                                                                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successful Groq              | Preview `dpl_5h9LHHUi5fvdAuFLfsuBSgHuzKDX`, commit `2befb12`: `openai/gpt-oss-20b` generated a greeting, selected `search_products`, received real read-only Supabase-backed catalogue results and included the target ID/price in returned product metadata.   |
| Groq outage → Gemini success | Retest `dpl_Fsibh3fx5exXQBU1cugKAp6JpHsr`, commit `60c2f56`: **injected primary 503**, then actual Gemini `gemini-3.1-flash-lite` generation succeeded with text and signed history. Groq outage was simulated; Gemini was not mocked.                          |
| Both providers unavailable   | Explicitly injected 503 failures produced `LLM_UNAVAILABLE`, no successful answer, no tool execution or write. Same branch is covered by unit/API/browser fault tests. This is controlled fault evidence, not an assertion that both public services were down. |
| Delivery contract            | Real Groq through the actual Express `/api/lumi` route returned **HTTP 200** with text, signed history and products array on a local listener **inside the Vercel preview-build host**. This is not a deployed protected-browser test.                          |
| Frontend rendering           | The added browser suite verifies primary/fallback/error responses through the real frontend at 390px, using mocked external transports. The existing 56 groups verify catalogue, cart, checkout, support and tool suggestions.                                  |

### Failed first attempt and retest limits

The initial Gemini fallback attempt used the inherited `gemini-2.5-flash` default and returned **404 `GEMINI_MODEL`**. The default was changed to a currently documented Flash Lite model and re-tested successfully. No real fallback success is claimed for the retired default or production's older model override.

The second Groq catalogue probe did run `search_products` and return text, but did **not** include the requested target ID/price in returned product metadata. The first probe did. This demonstrates why tool execution alone does not certify answer relevance or every live shopping interaction. The probe's generic `ok` flag means text/history returned; it is not an accuracy score. This limitation is retained in the evidence JSON rather than hidden.

The first preview probes ran with Vercel-selected Node 26 because the inherited engine range was `>=22`. The source/lockfile are now pinned to **22.x**, matching local tests. Pinned-runtime preview `dpl_Cjsnk44MMMSiAbDiVvqEQstLU4TN` for code commit `e00444a` reached READY/STAGED; logs confirm **22.x**, 139 packages installed and successful build. Probes were disabled. Provider availability claims refer to the explicit probe deployments above, not a full production release.

Temporary Groq preview scope was approved by the owner, applied without reading/changing the secret value, and restored to production-only. Provider probe flag is now `0`. Existing protected probe deployments retain deployment-time environment snapshots. No SSO bypass, production promotion, database mutation or email send occurred.

## Unit/integration coverage

- Existing checkout/security/schema tests: authoritative pricing, stored customer/item snapshots, concurrent/idempotent retries, stock conflicts, origin/JSON rules, owner-bound order lookup, support confirmation and safe unavailable storage.
- PGlite: PostgreSQL-compatible constraints/functions/migrations locally, not live Supabase.
- Supabase adapter: actual SDK with mocked HTTP/schema/owner/RPC/error assertions, not live HTTP writes.
- Existing Gemini recovery/policy tests: bounded transient retry, no tool replay, signed history, dedicated policy and secret redaction with canaries.
- New `llm-providers.test.js`: REST request/model/schema conversion, Groq-only success, fallback on eleven provider/network/status cases, history conversion with legacy call IDs, sticky fallback after tool execution, repeated-call deduplication, malformed/empty/truncated primary output, no frontend keys, redaction, unchanged HTTP contract and exact-only current privacy projection.
- New Python tests: sanitised blueprint topology, removal of bindings/private values, mapping preservation and no input mutation.

## Browser coverage and honest scope

The existing 56 groups cover all nine pages and twelve product links, image/local-link loading, search/filter, detail labels, persistent cart/reload, quantity/removal, explicit AI product selection, checkout validation/consent and saved local confirmation. Touch widths include mobile navigation, FAQ, support approval and checkout. A deliberate 503 catalogue fault recovers honestly. Production limits were not disabled to make these tests pass.

The new provider browser scenarios test the actual `#lumiInput` and message log, not an isolated JSON snapshot. They inspect displayed error/answer text and safe recovery controls. This is useful keyboard/responsiveness evidence, not a WCAG certification or screen-reader audit. Broader assistive-technology testing is still needed.

The committed screenshot is catalogue-only. Ignored `test-results/` includes local fictional checkout screenshots; these are not published customer records or mail proofs.

## Commands

```sh
npm ci
npm test
npm run test:browser
npm run test:browser:providers
python3 -m unittest discover -s tests -p '*_test.py'
npm run build
npm run format:check
npx prettier --check README.md NOTICE.md 'docs/**/*.md' docs/ci-workflow.example.yml automation/make/README.md
npm audit
npm audit --omit=dev
python3 scripts/check-doc-links.py
python3 scripts/audit-publication.py --all-refs
git diff --check
```

Do **not** casually run `npm run test:live:supabase`: it already includes `--allow-demo-writes` and may create durable orders/tickets and fire external email workflows. Migrations/seeding also require explicit review/permission. Live provider probes consume quota and require deliberate preview configuration.

## Outstanding checks

- Reconcile Make's working execution/revision with the supplied v1 mappings and current live notification objects. Map the two private webhook destinations to their actual scenarios before changing either.
- Inspect atomic notification claim/uniqueness and connected Gmail error handling; test retries/ambiguous provider outcomes in an approved staging flow with controlled inboxes.
- Actual Make import/rebinding of the sanitised template has not been performed.
- Full live-provider multi-turn routine/support/order interactions and deployed protected-browser rendering are not certified by the narrow provider probes. No new production checkout/notification test was authorised.
- Final production model override, preview database/session settings and rollout remain owner-controlled. Main is not merged.
- Complete privacy/asset/licence decisions and final repository artifact review before changing visibility.
