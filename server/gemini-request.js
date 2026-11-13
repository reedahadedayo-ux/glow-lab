// Retry only model generation, never tool execution. Keep all rounds within the API's 120s limit.
export const GEMINI_REQUEST_BUDGET_MS = 90000;
const MAX_ATTEMPT_MS = 40000;
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
    try {
      return await ai.models.generateContent({
        ...input,
        config: {
          ...input.config,
          httpOptions: { timeout: Math.min(MAX_ATTEMPT_MS, remaining) },
        },
      });
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
