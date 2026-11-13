# Lumi availability investigation — 2026-11-13

## Confirmed public-production failure

Read-only requests made from a Vercel preview build to https://glow-lab-puce.vercel.app (not a local mock):

| Request | HTTP | Application code | Duration |
| --- | --- | --- | --- |
| GET /api/config | 200 | — | 145 ms |
| POST /api/lumi, greeting | 503 | GEMINI_UNAVAILABLE | 24,213 ms |
| POST /api/lumi, CeraVe catalogue question | 503 | GEMINI_UNAVAILABLE | 24,480 ms |

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
