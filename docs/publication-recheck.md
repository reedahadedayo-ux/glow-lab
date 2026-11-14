# Public-release recheck — 13 November 2026

**Decision: remain private pending the unresolved checks below.** Visibility was not changed. No production integration, database, trigger, environment variable, main branch or deployment was changed.

## Fresh automated results

| Check | Result |
| --- | --- |
| Node unit/API tests | 50 passed |
| Storefront browser checks | 56 journey/page/viewport groups passed; local SQLite, mocked provider transports |
| Provider browser checks | 3 primary/fallback/error scenarios passed at 390px; external transports mocked |
| Publication-tool Python tests | 4 passed |
| Production asset build | Passed with all live diagnostics explicitly disabled |
| Built assets heuristic scan | 25 files, no findings |
| Formatting and diff checks | Passed |
| Full dependency audit | 0 reported vulnerabilities |
| Production dependency audit | 0 reported vulnerabilities |

No fresh live provider calls, customer orders or emails were made. These results do not certify production readiness.

## Source and history

The latest recheck resolved the shallow-history limitation: full ancestry for all eight remote branch heads and the five available pull-request head refs was fetched without switching or modifying working branches. The repository is no longer shallow. The all-ref scan covered 244 historical blobs and flagged two Make URL strings in a historical `.env.example`. Both were verified programmatically to contain only descriptive placeholder words, not opaque webhook identifiers. A separate scan covered all 129 existing publishable working files, including untracked additions, with zero findings. No confirmed credential was identified by these heuristic scans. This is not proof that no secret or personal data exists. No history rewrite, push or visibility change was performed.

Git history contains four distinct author/committer email identities: two GitHub users.noreply identities, one generic GitHub noreply address and one personal email address. The earlier description of two non-noreply addresses was misleading: only one is personal. Values are deliberately not reproduced in this document. The owner explicitly approved retaining their email in public history.

## GitHub-hosted surfaces

- Five pull requests were re-inspected with pagination, including available comments and reviews. The same credential-pattern scan reported no findings in the retrieved metadata/content.
- The releases endpoint returned zero releases and zero attached release assets. The repository commit-comments endpoint returned zero comments.
- The issues listing and Actions run/artifact endpoints were retried and still returned HTTP 403 (resource not accessible by integration). Issues, workflow logs and artifacts therefore remain uncleared. An authorised owner must review these surfaces or provide appropriately scoped access.
- Repository remains private; default branch remains main. GitHub reports no recognised code licence.

This is a credential-pattern review of accessible text, not clearance of all attachments, images, external links or all forms of personal information.

## Outstanding owner decisions / evidence

1. Confirm exposure review and any necessary rotation/rebinding for the privileged credential in the privately uploaded raw Make blueprint. At the owner's request, the credential value was subsequently removed from the workspace copy of that upload; the file remains valid JSON. The tracked template was already blank. This does not revoke the credential, remove the original chat attachment, erase platform-retained copies or modify production configuration.
2. **Owner confirmation received:** the owner states they have redistribution rights for the inherited images. This resolves the request for owner confirmation, not independent provenance verification or permission for downstream reuse. See [asset inventory](assets-and-licensing.md).
3. **Owner approval received:** retain the owner's email in public Git history; no author-history rewrite is requested.
4. Complete the inaccessible GitHub issue/log/artifact review, including attachments where applicable.
5. Choose a code licence if reuse permission is intended; public visibility alone is not a licence.

The documented Make reconciliation and staging/production-model limitations remain separate operational follow-ups; no operational fix or production approval is implied. See [release audit](release-audit.md) and [security review](security-review.md).

**Do not make the repository public based solely on passing tests or a heuristic scan.**
