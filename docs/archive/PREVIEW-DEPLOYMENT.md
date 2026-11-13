> **Historical implementation record.** This is not the current project status. Start with the [current README](../../README.md), [architecture](../architecture.md) and [workflow audit](../workflows.md). Later deployments and database configuration may supersede statements below.

# Vercel preview — 13 November 2026

User requested a preview for review before any production deployment.

- Project: existing `glow-lab`, `prj_HiLbF20EoK6RH2z5TcbHuKjZiaX1`.
- Branch: `arena/4283f31f-glow-lab`; committed/pushed app revision `2c62d26718bb08e0ef918f3aff0c530624d947a1`.
- Deployment: `dpl_2zwGLWsgTgeyETY8LkcKeeCazWXH`.
- Vercel status verified: **READY**, **STAGED**, environment **preview**, target null (not production).
- Preview: https://glow-monthexp8-reedahadedayo-uxs-projects.vercel.app
- Dashboard: https://vercel.com/reedahadedayo-uxs-projects/glow-lab/2zwGLWsgTgeyETY8LkcKeeCazWXH
- Branch alias: https://glow-lab-git-arena-4283f31f-glow-lab-reedahadedayo-uxs-projects.vercel.app

Created preview-only, branch-scoped DATA_BACKEND, SUPABASE_URL, SUPABASE_DB_SCHEMA, SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET environment variables. Secret values use Vercel sensitive storage, not Git or frontend bundles. No production variables changed. Existing unused legacy automation variables were not modified or used.

The branch first had to be pushed before Vercel accepted branch-scoped variables. The manual deployment was created after the variables were saved. Local suite rerun: 23 tests pass and build passes.

**Protection and verification boundary:** the project retains its existing Vercel authentication protection. An unauthenticated fetch to `/api/ready` was redirected to Vercel login, so deployed catalogue/checkout/DB connectivity has not yet been smoke-tested. Build READY does not prove those paths. Sign in with the owning Vercel account to review. No protection was disabled and no bypass token was retrieved.

Gemini remains unconfigured; no real Lumi model response is claimed. The preceding PRODUCTION-READINESS report remains the detailed test/gate history, but its statement that no push or Vercel preview exists is superseded by this record. No production release has occurred.

Confirmed latest READY production deployment remains the preexisting `dpl_En6EwuqBkpjEMCt8aWvtcVmK9Ekf` (older commit `fb38afc786491b2cc9694e788ee58ee7c9e89f8a`). Do not promote this preview or update production domains without the user's approval.

## Superseding Gemini-enabled preview

On 13 November 2026, deployed revision `65120a6` as **READY / STAGED preview** `dpl_7BP2WMGLhV45R6Ej38T1YCERUBcg`: https://glow-4yvbc5x4g-reedahadedayo-uxs-projects.vercel.app .
Read **GEMINI-VERIFICATION.md** for actual successful Gemini SDK/search/routine and Supabase HTTPS evidence, model correction to gemini-3.5-flash, secret audit and remaining public-preview acceptance boundary. The earlier statement that Gemini is unconfigured is superseded. Production remains untouched.
