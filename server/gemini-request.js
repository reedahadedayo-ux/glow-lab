import { withDeadline } from "./request-deadline.js";
// Only generation is retried, never tools. Disable SDK's default five attempts:
// otherwise two application attempts can multiply hidden network retries.
export const GEMINI_REQUEST_BUDGET_MS = 35000;
export const GEMINI_ATTEMPT_MS = 8000;
export function isTransientGeminiError(error) {
  return (
    [502, 503, 504].includes(error?.status) ||
    ["AbortError", "TimeoutError"].includes(error?.name) ||
    (error instanceof TypeError && error.message === "fetch failed")
  );
}
export async function generateWithRecovery(
  ai,
  input,
  deadline,
  now = Date.now,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - now();
    if (remaining <= 0)
      throw Object.assign(new Error("Gemini request deadline exceeded"), {
        name: "TimeoutError",
      });
    const timeout = Math.min(GEMINI_ATTEMPT_MS, remaining);
    try {
      return await withDeadline(
        (abortSignal) =>
          ai.models.generateContent({
            ...input,
            config: {
              ...input.config,
              abortSignal,
              httpOptions: { timeout, retryOptions: { attempts: 1 } },
            },
          }),
        timeout,
      );
    } catch (error) {
      if (
        attempt === 1 ||
        !isTransientGeminiError(error) ||
        deadline - now() < 1000
      )
        throw error;
    }
  }
}
