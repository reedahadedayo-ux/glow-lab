# Reliability repair deployment status

## Current result — Production published

The owner explicitly selected **Publish to the public website**, accepting that pending Preview runtime verification would be skipped. Created Production deployment from the existing remote branch's exact repaired commit; no merge into `main` and no environment/protection mutations were performed during this publication.

- Source: `72371d3a328a72289a717836392bc623d0ab46a3`, branch `arena/7e7ec798-glow-lab`.
- Production deployment: `dpl_12tFZkpZJRTsF8eZUn7p4wUR6k3c`.
- Vercel result: **READY / PROMOTED**, alias assigned, no alias error.
- Public website: https://glow-lab-puce.vercel.app/
- Dashboard: https://vercel.com/reedahadedayo-uxs-projects/glow-lab/12tFZkpZJRTsF8eZUn7p4wUR6k3c
- Previous Production deployment retained: `dpl_GGbMntQiyKmiNNsHZ4StWUACuD1c`.

Post-publication public HTTP checks:

- `/api/ready`: `ready:true`, `database:supabase`, `catalogueCount:12`, both provider configuration flags true.
- `/api/config`: Supabase storage, Lumi configured, both providers configured, simulated payments true.
- `/contact`: repaired cross-browser order-reference/email lookup form present, including limited-status/totals copy.

These are readiness/content checks, not proof of live model generation, order lookup correctness against real records, checkout, email delivery or desktop/mobile interaction. No test orders, customer-record writes or test emails were performed. Production keys, model override and protection settings were left unchanged.

Workspace note: the restored local Git HEAD was the base commit while the prior repair files remained in the working tree. The remote branch and existing Preview independently confirmed the repaired SHA above. Publication used that exact remote SHA rather than the local HEAD; local edits were not reset, staged, committed or overwritten. Only this deployment record was updated locally.

The sections below are historical Preview-stage evidence and limitations; their statements that Production was unchanged describe that earlier stage, not the current result.

## Earlier Preview result

- Code committed and pushed only to `arena/7e7ec798-glow-lab`.
- Source commit: `72371d3a328a72289a717836392bc623d0ab46a3`.
- Vercel Git integration automatically created deployment `dpl_3BK9WW44YBMd8sTqVGNxP7HL9ii6`.
- Status verified through Vercel: **READY / STAGED**, Preview target, Node **22.x**.
- Preview: https://glow-1fwt6aly9-reedahadedayo-uxs-projects.vercel.app/
- Vercel dashboard: https://vercel.com/reedahadedayo-uxs-projects/glow-lab/3BK9WW44YBMd8sTqVGNxP7HL9ii6

## Checks

The exact tested working tree was checkpointed, the current branch fast-forwarded to its existing remote tip, and that same tree restored before creating the new commit. Existing history and pending changes were preserved. No force-push, other-branch checkout or main modification was performed.

Preflight rerun: 136 tracked files passed the heuristic credential-pattern scan; 67 Node/API tests passed; local production asset build and staged diff check passed. Earlier browser results for this same source tree are recorded in the [repair report](reliability-and-retailer-audit.md).

Vercel build metadata confirms source commit and Node 22.x packaging. This is not runtime verification.

## Promotion blockers

1. HTTP reads of preview Contact and `/api/ready` redirected to Vercel login. Deployment protection was left intact; the deployed page/API could not be authenticated and tested with the available tools.
2. Deployment environment-name metadata omits `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_SCHEMA`, `DATA_BACKEND` and `GROQ_API_KEY`. The branch is not configured for the intended database/session/Groq runtime. Gemini's key is present by name; successful generation is not established. Source defaults can supply schema/backend choices but cannot replace the missing secrets/URL.
3. Distributed lookup rate enforcement and staging/live-provider verification remain operational follow-ups documented in the repair report.

**Production was not promoted or changed.** No secrets were read/decrypted/changed, no variable scopes were expanded, no database records or triggers were changed and no test emails were sent. The repository remains private.

## Approved Preview configuration — partial completion

The owner approved private Preview configuration. Created these settings scoped exclusively to Preview on `arena/7e7ec798-glow-lab`:

- `DATA_BACKEND`: Supabase mode.
- `SUPABASE_URL`: the existing approved GlowLab project endpoint.
- `SUPABASE_DB_SCHEMA`: existing GlowLab commerce schema.

No Production variable, other branch's override, key value or deployment-protection setting was changed. Gemini's existing Preview key was already configured and left intact. The three new settings are saved for subsequent deployments; immutable deployment `dpl_3BK9WW44YBMd8sTqVGNxP7HL9ii6` has not been redeployed with them.

### Remaining private inputs

`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` and a stable Preview-only `SESSION_SECRET` still need branch-scoped sensitive entries. The connector can create a variable from a supplied value or change an existing variable's scope, but exposes no blind branch-specific clone operation for the existing sensitive entries. Decrypting secrets is prohibited by the owner's instructions; expanding their scope across all preview branches or moving another branch's sensitive override is not approved. No placeholder credentials were created.

The owner must enter the existing approved key values privately in Vercel's environment-variable UI for this branch, and generate a separate random session secret of at least 32 characters for Preview. Do not paste values into chat. This is not a request to rotate unrelated API keys. If the affected Supabase key has been replaced, use the approved replacement.

After those entries are saved, redeploy this same source commit and perform authenticated checks. Vercel login protection remains enabled; the connector has no authenticated application HTTP/browser request tool. The existing production Gemini model override also needs explicit review against the tested fallback default before promotion; it was not silently changed.
