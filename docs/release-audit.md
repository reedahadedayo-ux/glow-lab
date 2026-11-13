# GlowLab public-release audit and handoff

**Date:** 13 November 2026 · **Branch:** `arena/7e7ec798-glow-lab` · **Repository:** [existing GlowLab](https://github.com/reedahadedayo-ux/glow-lab/tree/arena/7e7ec798-glow-lab)

## Assessment

**Technically prepared for private owner review; not unconditionally cleared for public visibility.** Groq-primary/Gemini-fallback is implemented and real-provider tested. Storefront/checkout have local functional coverage. The owner reports working order emails and the supplied actual Make blueprint is documented. Remaining publication gates concern credential exposure response, author privacy, third-party assets/licensing and final repository artifacts. Make configuration mismatches remain honest limitations, not a blanket claim that delivery is broken.

No main merge, visibility change, production promotion, database write, live customer email, trigger removal or inherited-history deletion was performed. The separate portfolio website is unchanged.

## What changed

- Added a server-only Groq REST adapter and sticky Gemini fallback around the existing orchestration. Same endpoint, policy, history, tools and explicit approval boundaries; no duplicate assistant implementation.
- Validated/normalised Groq tool calls before execution, converted legacy history/call IDs and added request-scope identical-tool deduplication to avoid replays after failover.
- Added safe provider diagnostics, Groq redaction and nonsecret readiness/configuration flags. Replaced the unavailable Gemini default with a live-verified Flash Lite default.
- Added deliberate preview-only live-provider probes and unit/API/frontend fault coverage. Temporary secret scope/diagnostic settings were restored after real tests.
- Corrected the old Gemini-only header configuration check to use provider-agnostic `lumiConfigured`, avoiding an unavailable label when Groq alone is configured. Corrected chat/privacy disclosures to include Groq/Google fallback and avoid falsely saying acknowledgement emails never exist. Exact-only backend projection updates the inherited privacy text without writing production policy records or overriding future configured content.
- Pinned Node to the locally tested 22.x major after preview warnings showed the floating range selecting Node 26.
- Inspected the supplied Make blueprint privately; added a sanitised unbound template, sanitizer/tests, real module documentation and explicit live-configuration reconciliation findings. Removed no live scenario or trigger.
- Added asset/source/licence inventory and lossless JPEG EXIF/comment stripping for two images and their legacy copies; decoded pixels verified unchanged. Catalogue IDs/prices/image references are preserved.
- Updated current README, architecture/setup/testing/workflows/case study/security/handoff; retained historical archive. Added release evidence, stronger ignore rules and all-local-ref scanning. No artificial product claims, statistics or business outcomes added.

## File inventory for this release-preparation request

### Created

- `server/groq.js`, `server/llm-router.js`, `server/policy-copy.js`
- `scripts/verify-live-providers.js`, `scripts/sanitize-make-blueprint.py`, `scripts/strip-image-metadata.py`
- `tests/llm-providers.test.js`, `tests/browser-providers.mjs`, `tests/publication_tools_test.py`
- `automation/make/README.md`, `automation/make/order-acknowledgement.sanitized.blueprint.json`
- `docs/release-audit.md`, `docs/assets-and-licensing.md`, `docs/evidence/provider-probes.json`

### Modified

- Runtime: `server/lumi.js`, `server/app.js`, `server/tools.js`, `server/secret-safety.js`
- Browser disclosure only: `js/script.js`, `js/storefront-copy.js`
- Configuration/tooling: `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `scripts/build-public.js`, `scripts/audit-publication.py`
- Regression/default assertion: `tests/gemini-security.test.js`
- Current docs: `README.md`, `docs/architecture.md`, `docs/setup.md`, `docs/testing.md`, `docs/workflows.md`, `docs/security-review.md`, `docs/github-handoff.md`, `docs/portfolio-case-study.md`, `docs/ci-workflow.example.yml`
- Metadata-only images: `images/paulas-choice-bha.jpg`, `images/skin1004-centella.jpg` and their corresponding `glowlab-skincare/images/` copies

### Removed

**No tracked files removed for this request.** The raw uploaded blueprint was never tracked. Its private bindings/values, captured metadata and disconnected orphan modules are omitted only from the newly sanitised template. The earlier historical-document archive remains intact.

## Provider acceptance evidence

| Requested path        | Evidence                                                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groq success          | Real `openai/gpt-oss-20b` replies in protected Vercel preview-build probes, including model-selected catalogue tool and first-run target ID/price match.                                              |
| Groq failure → Gemini | Injected Groq 503 followed by real `gemini-3.1-flash-lite` response with text/history. First old-default attempt failed 404; fixed and retested, not hidden.                                          |
| Both unavailable      | Controlled dual 503 injection returns friendly `LLM_UNAVAILABLE`; local API/browser tests confirm non-success delivery and usable controls.                                                           |
| Frontend delivery     | Real Groq HTTP 200 through Express contract on preview-build host; three local browser primary/fallback/error scenarios use mocked external transports. No full deployed live-provider browser claim. |

Exact deployments/commits and the second catalogue probe's relevance limitation are in [test evidence](testing.md) and [sanitised results](evidence/provider-probes.json). Narrow probe success is not a claim of every multi-turn order/routine/support interaction being certified live.

## Make evidence and unresolved reconciliation

Owner-provided successful email test is recognised. Supplied v1 contains webhook filtering, claim RPC, fixed delay, nested order/item query, iterator/aggregation, Gmail and sent/failed PATCH branches, with specific HTTP retry handlers. See [actual mapping](workflows.md).

Live metadata shows **two distinct Make destinations** on enabled order INSERT hooks. No destination URL is published. Their creation reason, intended scenarios and relation to the supplied hook cannot be determined from available evidence. The notification claim/table are absent from inspected live metadata, item-name fields differ, and the Gmail error route is disconnected in the export. These findings require private review of the working scenario/revision/run; neither hook was altered.

The sanitised JSON parses and regression tests pass; actual Make import/rebinding was not performed. Notification exactly-once claims, retry safety, inbox/spam placement and status reconciliation are not inferred from one successful delivery. No new email test was sent.

## Security findings and resolutions

- Raw blueprint privileged credential excluded; variable values/bindings/private URLs/account metadata removed in the public template. **Rotation/exposure review remains owner-controlled**, not silently performed.
- All-local-ref heuristic scans: 128 tracked files, zero findings before and after the code commit (174 pre-final historical blobs, then 204). Offline dedicated scan: 16 current-tree flags reviewed as test canaries/documentation/commit-deployment IDs; 26 historical snapshots yielded 84 test-canary flags, no confirmed credential. Source/history scans and redaction tests distinguish test canaries from credentials. New scanner option includes all locally available refs; external GitHub artifacts still need separate review.
- Live Supabase: six tables RLS-enabled, no anon/authenticated commerce grants, invoker RPCs with empty search paths and service-role execute. Backend owner checks remain essential.
- Signed history is not encrypted, rate limits are per-process and guest recovery is limited. These are documented design boundaries.
- Four distinct author/committer email identities were observed, two not GitHub-noreply. No values reproduced. Keep history unchanged until the owner decides on privacy.
- No image redistribution evidence supplied; no licence invented. Asset inventory and selected catalogue-only screenshot support review without exposing customers. Metadata stripping does not solve asset rights or remove historical versions.

## Build and deployment boundaries

Local test/build/format/audit results are listed in [testing](testing.md). The code probe previews reached READY, and actual provider calls were verified via deliberate safe build diagnostics. Pinned-runtime preview `dpl_Cjsnk44MMMSiAbDiVvqEQstLU4TN` for code commit `e00444a` reached **READY/STAGED**. Logs explicitly confirm Node changed from 26.x to **22.x**, 139 packages installed and build completed. Provider probes were disabled for that build. This verifies packaging, not deployed checkout; no production promotion is implied.

The environment inventory did not show shared database/session configuration for this branch. A READY static/API package does not establish a working deployed checkout. Configure approved staging variables privately for further end-to-end review. Production's older Gemini model override also needs review against the tested fallback before rollout. Existing protected probe deployments retain environment snapshots after project-scope restoration.

## Owner checklist before public visibility

1. Review/resolve the private blueprint credential exposure and any coordinated rotation/rebinding; never commit a configured raw export.
2. Approve author/committer privacy and retained historical test identifiers. No history rewrite is authorised automatically.
3. Confirm image redistribution rights or explicitly approve replacements, and choose a code licence separately.
4. Review final source/history/intended refs plus GitHub issues, PRs, logs, attachments/releases; enable available secret-scanning protections.
5. Approve technically accurate README/case-study claims and the actual Make reconciliation plan. Supply a redacted successful execution/revision mapping if resolving the export/live differences.
6. Privately map both webhook destinations to scenarios; explain intent before approving any disable/change. Verify notification claim uniqueness and send-failure/retry handling in staging.
7. Configure/review production fallback override and staging database/session/provider settings; approve merge/deployment separately. Do not use real customer details or send live emails for portfolio screenshots.
8. Activate the CI template with suitable GitHub workflow permission if desired. No remote Actions pass is claimed.
9. Explicitly approve visibility change only after these decisions. The repository remains **private**.

## Portfolio positioning

The project is a real, tested demo with actual Groq and Gemini evidence and owner-tested notification functionality. It demonstrates commerce validation, AI tool orchestration, private storage and automation design. It is not claimed as a fully operated retail business, clinical system, exactly-once mail service or production-ready platform. [Case study](portfolio-case-study.md).
