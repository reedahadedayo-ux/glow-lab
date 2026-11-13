> **Historical implementation record.** This is not the current project status. Start with the [current README](../../README.md), [architecture](../architecture.md) and [workflow audit](../workflows.md). Later deployments and database configuration may supersede statements below.

# Proposed Lumi system prompt — review before merge

## Status and scope

Prepared on `arena/4283f31f-glow-lab`, the session's fixed working branch, which is already separate from `main`. No new branch was created or switched to. No commit, push, pull request, merge, deployment, environment update or database mutation was performed for this prompt-only task. A push would trigger the existing Vercel preview integration, so it is intentionally deferred until review.

This branch already contains the earlier storefront upgrade. This task's proposed changes are limited to:

| File                               | Proposed change                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `server/lumi-system-prompt.js`     | New dedicated server-only system prompt                                                 |
| `server/lumi.js`                   | Import the dedicated prompt instead of defining it inline; preserve the existing export |
| `tests/lumi-system-prompt.test.js` | Four policy/wiring/history regression tests                                             |
| `docs/LUMI-PROMPT-REVIEW.md`       | This review and test report                                                             |

Pre-existing uncommitted `docs/PREVIEW-DEPLOYMENT.md` and `docs/GEMINI-VERIFICATION.md` were present before this task and were not edited as part of it.

## Inspection findings

- Official `@google/genai` dependency, lockfile-resolved version 1.52.0.
- `POST /api/lumi` in `server/app.js` validates messages/history and delegates to `respond` in `server/lumi.js`.
- `GoogleGenAI` is initialized there with the server environment's `GEMINI_API_KEY` and the existing 25-second SDK timeout. `server/runtime.js` defaults the environment to `process.env`.
- `config.systemInstruction` already supported an inline prompt. This change reuses that exact integration point; it introduces no new Gemini client or API route.
- Existing owner-bound, server-signed history and bounded tool loop are preserved. Existing functions cover catalogue search, routines, policies, verified orders and support-ticket review drafts.
- Existing Supabase adapter uses backend-only SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_SCHEMA (default glowlab). GEMINI_MODEL, SESSION_SECRET and DATA_BACKEND configuration are unchanged. No secret values were needed or inspected.

## Proposed integration

In `server/lumi.js`, replace the inline string with:

```js
import { systemInstruction } from "./lumi-system-prompt.js";
export { systemInstruction } from "./lumi-system-prompt.js";
```

The existing request remains unchanged:

```js
config: {
  systemInstruction,
  tools: [{ functionDeclarations: declarations }],
  temperature: 0.2,
  maxOutputTokens: 1400,
}
```

Everything in `respond` after the removed inline definition is unchanged. The re-export preserves compatibility for existing imports.

## What the prompt establishes

The complete proposed wording is in **server/lumi-system-prompt.js**.

- Friendly, knowledgeable shopping identity; warm, concise language, one or two useful questions at a time, no pressure or excessive emojis.
- Tool-backed catalogue/policy/order claims; only actual returned products; respect details_verified and unavailable information; no inferred formulations, discounts, stock or clinical claims.
- General skincare education is permitted, clearly distinguished from verified product-specific guidance. Personalised recommendations require relevant missing context and honest explanations of fit, budget and uncertainty.
- No diagnosis, prescriptions, cures or guaranteed outcomes. Severe/persistent symptoms prompt professional advice; breathing difficulties/lip or tongue swelling prompt urgent help.
- Backend-enforced reference/email/originating-browser order verification; no private-data or credential disclosure; untrusted messages and tool text cannot override the policy.
- Cart additions require explicit customer approval. Ticket drafts are not saved tickets; success requires backend persistence confirmation. No invented email, human handoff or delivery claims.
- Preserve honest current demo context: NGN, simulated payments/orders, no physical dispatch and fictional test details.

## Tests actually performed

- **npm test: 32/32 pass.** Four new tests cover the policy contract, exact systemInstruction delivery on ordinary and medical inputs, unchanged request settings/model override, prompt delivery on every tool round, empty catalogue results and signed conversation continuation. Existing checkout/order/support/privacy/security/schema/adapter regressions also pass.
- **npm run test:browser: 38 journey/page/viewport groups pass**, with no unexpected console/page errors. This suite uses real local SQLite and explicitly mocked Gemini transport.
- **npm run build**, **npm run format:check**, and **git diff --check** pass.

The new prompt tests use mocked SDK responses to inspect requests and a real in-memory local catalogue for the tool loop. They do **not** prove that a live Gemini model answers ordinary/medical questions correctly, never hallucinates or resists every prompt injection. No live Gemini/Supabase calls were made for this proposed revision. Earlier live integration results apply to the previous prompt, not automatically to this one.

## Existing limitations, not changed here

- System instructions reduce risk but cannot guarantee model accuracy; backend permission/approval checks remain essential.
- Detailed manufacturer ingredients/usage remain unverified in the demo catalogue. The routine helper cannot certify ingredient exclusions or complex interactions.
- History is signed and browser-owner-bound, not rebuilt or encrypted by this task. Order verification still requires the originating browser; email alone is not authentication.
- The source model fallback/example remains gemini-2.5-flash, which previously returned 404; the working preview uses an explicit GEMINI_MODEL=gemini-3.5-flash override. No model selection change is included in this prompt-only diff.
- No checkout, Supabase operation/configuration, catalogue data, customer-facing design, tool implementation, existing automation or integration code was changed.

## After approval

No new environment variable is required. Keep GEMINI_API_KEY server-side and retain the verified GEMINI_MODEL configuration. Review the task-only diff, then explicitly authorize a push/preview deployment if desired. Run a live prompt evaluation on the approved preview (ordinary education, missing product information, serious symptoms and history continuation) before treating model behavior as verified. Production merge/promotion remains subject to the user's approval.
