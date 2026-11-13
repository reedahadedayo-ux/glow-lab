# GitHub and deployment handoff

- Existing repository: https://github.com/reedahadedayo-ux/glow-lab (**private**).
- Prepared branch: [`arena/7e7ec798-glow-lab`](https://github.com/reedahadedayo-ux/glow-lab/tree/arena/7e7ec798-glow-lab), based on main `b49092935bdfb72119a61e56e9e2529294e6bb23`.
- Work is committed/pushed only to this branch. No main merge, visibility change, inherited-history deletion or production promotion is authorised/performed.
- Original Vercel linkage and production branch remain unchanged. Protected previews are created by normal branch pushes.

## Preview verification and secrets

With explicit owner approval the existing Groq secret temporarily gained preview scope, without reading/changing its value. Real Groq and Gemini fallback were verified on the preview-build host. Original production-only Groq scope was then restored and `GLOWLAB_VERIFY_PROVIDERS` reset to `0`. The evidence deployments retain their deployment-time snapshots and remain protected; no SSO/protection setting was weakened.

Later previews will not automatically have Groq configured after scope restoration. The inventory also did not show shared Supabase/session configuration for this branch. Configure an approved staging environment privately before claiming full deployed checkout functionality. Do not create production orders or send emails merely for review.

Production's older `GEMINI_MODEL` override is not the newly tested fallback default. Review it, the pinned Node runtime and rollout settings before an approved merge/promotion. [Setup](setup.md) · [Exact test evidence](testing.md).

## GitHub Actions

The GitHub App connection rejected workflow creation without `workflows` permission. `docs/ci-workflow.example.yml` remains an **inactive template**. Owner activation requires suitable permission, moving/reviewing it under `.github/workflows/ci.yml` and updating its formatting path. No GitHub Actions pass is claimed.

## Public release

Use the [release audit](release-audit.md), [security gates](security-review.md) and [asset inventory](assets-and-licensing.md). Resolve raw-blueprint credential exposure/rotation, author privacy, licence/asset rights and final artifacts before explicitly approving visibility change. Do not publish automatically.

The earlier preferred separate repository name was blocked by `createRepository` permission. The current request uses the existing GlowLab repository, so no separate repository is required or created here.

## Portfolio

The [case study](portfolio-case-study.md) now covers the Groq-primary/Gemini-fallback implementation, real-provider evidence and the actual supplied Make blueprint with owner-tested delivery. The separate portfolio website was not modified. Preview any content adaptation there before production; do not invent commercial metrics or erase demo/testing boundaries.
