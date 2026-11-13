# Security and publication review

**Review date: 13 November 2026. Decision: keep private.** No confirmed secret was found in the reviewed source/history, but this is not an exhaustive security certification or permission to publish. No visibility change was performed.

## Review scope and findings

| Surface                               | Result / limit                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tracked source, env and private paths | Reviewed; no tracked real `.env`, private key or database file found. `.env.example` now has blank values only.                                                                                                                                                                                                                                                                                                 |
| HEAD ancestry                         | Full, non-shallow history: 22 pre-preparation commits and 133 unique historical blobs at initial audit. Commit messages/blobs checked by the repository heuristic scanner.                                                                                                                                                                                                                                      |
| Dedicated offline scanner             | Temporarily installed `detect-secrets` outside the repo. Scanned current tracked snapshot and all 22 ancestor snapshots with online validation disabled. Five unique flagged locations, 56 flags across snapshots: intentional test-only secrets in `backend.test.js`, `browser.mjs`, `gemini-security.test.js`, `lumi-system-prompt.test.js`, `supabase-adapter.test.js`. Reviewed as canaries, not real keys. |
| Webhook URLs and tokens               | No matching literal destination/key found by reviewed rules. Live database trigger names/arguments contain private integration material; they were **not copied** into files or Git. Docs include aggregate counts only.                                                                                                                                                                                        |
| Customer/order information            | Reviewed source email fixtures use reserved example domains; no real customer rows were retrieved for this audit. Archived integration evidence contained opaque historical test order/ticket references; removed from the current files. Those references remain in retained ancestry. Owner should review them before publication.                                                                            |
| Git author metadata                   | Three distinct author email identities exist in inherited history. Values are not reproduced. Owner privacy/consent review is still required before exposing history publicly.                                                                                                                                                                                                                                  |
| Dependency advisories                 | `npm audit` and production-only audit reported zero known vulnerabilities at check time. This does not cover unknown flaws or external workflow configuration.                                                                                                                                                                                                                                                  |
| Public asset boundary                 | Build and server use public allowlists; root secrets/source are not published by normal build. Do not bypass with a generic root static server.                                                                                                                                                                                                                                                                 |
| External repository artifacts         | GitHub Actions logs/artifacts, issues, PRs, screenshots, releases and externally hosted files are not certified clean by a Git blob scan. Original repository remains private.                                                                                                                                                                                                                                  |
| Images and licence                    | Redistribution evidence is missing. No licence selected automatically; see [notice](../NOTICE.md).                                                                                                                                                                                                                                                                                                              |

`detect-secrets` was a temporary audit tool, not a committed dependency or permanent CI guarantee. No network verification of candidate credentials was requested. A negative scanner result is not proof that every kind of sensitive text has been detected.

## Existing protections

- Provider/service-role secrets used server-side; browser does not call privileged Supabase APIs.
- Private commerce schema/RLS contract; backend owner filtering is essential because service role bypasses RLS.
- HttpOnly/SameSite session cookie; Secure in production; HMAC-derived owner scope and signed expiring action/history tokens.
- JSON/body/origin validation, Zod schemas, output escaping, headers/CSP, safe error messages and redaction tests.
- Authoritative prices, atomic snapshots and owner-bound idempotency for order creation.
- Rate limits and bounded model calls; explicit customer approval for cart additions/support submission.

These protections have limits. Rate-limit memory is per-process, signed history is readable rather than encrypted, and a guest browser cookie is not an account/recovery system. Runtime/provider behaviour and operational access policies need separate review.

## Open security/operational concerns

1. Review both enabled Make INSERT hooks, private connection permissions, webhook authentication, duplicate handling and scenario data minimisation. No Make run/export was inspected.
2. No notification-state/outbox contract is present. Checkout idempotency does not guarantee exactly-once mail.
3. User messages and tool outputs used for conversation are sent to Google. Signed history can include customer input; use fictional data and avoid sensitive medical/payment information. Retention/deletion and encrypted/server-held chat deserve further design.
4. Direct backend policy text can differ from narrowly adapted storefront policy copy. Resolve authoritative policy content through a reviewed update, not fabricated UI promises.
5. Pin and revalidate a deliberate deployment Node major; the current `>=22` range is broad.
6. Confirm current grants, production logging/redaction, backups, retention and deployed headers independently before any real trading use. The audit did not pull customer rows or reconfigure production.

## Re-run before release

```sh
# Stage only reviewed work first; new untracked files are outside git ls-files scans.
git add -- .env.example .gitignore README.md NOTICE.md docs scripts/audit-publication.py scripts/check-doc-links.py docs/ci-workflow.example.yml
python3 scripts/audit-publication.py --history
python3 scripts/check-doc-links.py
git diff --cached --check
```

The helper reports locations/rule names, not matches. It scans the tracked **working-tree** version and HEAD-reachable objects/messages, not the staged blob snapshot or every remote ref. Review the staged diff too; rerun a dedicated scanner on final history before publication. Keep private exports, databases, screenshots with personal details and scan scratch data outside Git.

## Owner-controlled publication gates

- [ ] Review author/committer email privacy and inherited historical test identifiers; decide explicitly whether preserved ancestry is suitable for public display.
- [ ] Confirm no secret in final source, all intended refs, PR/issues/logs/releases or attachments; enable GitHub secret scanning/push protection where available.
- [ ] Confirm image permissions; choose a code licence without granting rights to third-party assets inadvertently.
- [ ] Create the preferred **private** repository or reconnect GitHub with repository-creation permission; preserve the original Vercel link.
- [ ] Review the private prepared branch and documentation; request visibility change separately only after the review.

No code-secret blocker was confirmed. **It is not yet cleared for public release** because owner privacy/rights decisions and final repository artifact review remain outstanding. That is distinct from claiming the application is unsafe to run as a private fictional-data demonstration.
