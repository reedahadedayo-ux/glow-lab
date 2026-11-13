import originals from "../data/policies.json" with { type: "json" };
const legacyPrivacy = originals.find((p) => p.slug === "privacy").content;

// Correct only the exact historical privacy policy; never override new owner-authored text.
// No database writes: both the API and assistant see the same current disclosure.
export function publicPolicy(policy) {
  if (policy.slug !== "privacy" || policy.content !== legacyPrivacy)
    return policy;
  return {
    ...policy,
    content:
      "Use fictional contact and delivery details for this demonstration store. Orders and support requests are saved privately. Cart items stay in your browser. Order lookup requires the browser session that placed the order, its reference and checkout email; email alone does not grant access. Lumi messages and relevant conversation/tool context may be sent to Groq and, on fallback, Google Gemini. Do not include payment information or sensitive medical details. Order acknowledgements use the configured Make workflow; no marketing emails are sent. Support submission does not guarantee an email reply or account recovery.",
  };
}
