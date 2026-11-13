> **Historical implementation record.** This is not the current project status. Start with the [current README](../../README.md), [architecture](../architecture.md) and [workflow audit](../workflows.md). Later deployments and database configuration may supersede statements below.

# Lumi availability investigation — 2026-11-13

## Confirmed public-production failure

Read-only requests made from a Vercel preview build to https://glow-lab-puce.vercel.app (not a local mock):

| Request                                   | HTTP | Application code   | Duration  |
| ----------------------------------------- | ---- | ------------------ | --------- |
| GET /api/config                           | 200  | —                  | 145 ms    |
| POST /api/lumi, greeting                  | 503  | GEMINI_UNAVAILABLE | 24,213 ms |
| POST /api/lumi, CeraVe catalogue question | 503  | GEMINI_UNAVAILABLE | 24,480 ms |

Evidence: preview build `dpl_4Y33i13a29cYHiU924fCwdGg4r1i`, commit `e71576e`, marker `GLOWLAB_PUBLIC_LUMI_PROBE`. Failure request IDs: `786393ab-9b26-4738-b7e9-f83390e3163d` and `a1ff454d-8f44-4802-ab89-2704e6c6da18`.

A second build at `6e8d101`, `dpl_6aeJhy9XtMUcnj1u23Lsg2nwdUR3`, reproduced 503 for both messages (23,578 ms and 9,425 ms). This is not merely a browser connectivity error. The route reaches the Gemini orchestration's exception handler. The public response deliberately does not reveal upstream exception text.

## Boundaries

- No key values fetched, decrypted, printed or committed.
- No checkout, catalogue, database, migrations, domain or deployment-protection changes.
- Public probe preserves cookies and signed-history continuity without logging either.
- Diagnostic scripts are opt-in and preview-only; production builds never execute them.
- Local automated tests: 32 passed. Browser groups: 38 passed (Gemini mocked, not availability proof).
- A direct sandbox public POST failed with ECONNRESET; it is not used as service-health evidence.

## Pending

A separate official-SDK probe compares a minimal greeting with the complete Lumi system instruction and tool declarations, using the production model `gemini-3.5-flash` and a 60-second diagnostic timeout. It emits only allowlisted metadata, not raw exceptions or model responses. Root cause and repair are not yet established.

## Established failure mode and focused recovery

The official SDK comparison in `dpl_6aeJhy9XtMUcnj1u23Lsg2nwdUR3` returned an upstream **504 after 59,272 ms** for a minimal greeting, then succeeded with the complete Lumi prompt/tool declarations in **19,162 ms**. This demonstrates intermittent upstream gateway/deadline failure, not a consistently invalid prompt or key. It does not identify the upstream infrastructure's internal cause.

The revised responder allows up to 40 seconds per generation attempt, retries transient 502/503/504 or transport abort/network failure once per round, and shares a 90-second generation deadline across rounds. It never replays tool execution. Authentication, model, request and quota errors are not retried. No fallback AI response is fabricated.

Live verification of the revised responder at `2342724`, preview build `dpl_8wzYadZxjJCFPPBeVnrWNiYuqdqK`, passed:

- Actual official SDK greeting: nonempty response, 19,125 ms.
- Actual official SDK catalogue question with signed-history continuity: nonempty response, 83,165 ms.
- Model-decided `search_products`, successful real public-production Supabase catalogue read (12 records), returned `cerave-foaming` at 14,500.
- This verifies the revised implementation from a preview build, **not yet the revised public-production HTTP route**. The existing production route still failed 503 during the baseline in that build.
- 36 automated tests pass, including transient failures, non-retryable errors, deadline expiry and exactly-once tool execution despite a generation retry. 38 browser groups pass (mock Gemini transport).

The public-HTTP and implementation diagnostics now have independent preview-only opt-ins: `GLOWLAB_PROBE_DEPLOYED_LUMI=1` and `GLOWLAB_PROBE_GEMINI_RECOVERY=1`. The branch-specific public probe flag was disabled after diagnosis. Production model/key/prompt/catalogue/checkout configuration remains unchanged.
