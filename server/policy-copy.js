import originals from "../data/policies.json" with { type: "json" };
const legacyPrivacy = originals.find((p) => p.slug === "privacy").content;
const customerCopy = {
  delivery:
    "No products are dispatched through this demonstration checkout. Delivery dates and courier tracking are not available. The delivery amount shown at checkout is not a free-shipping offer. Order acknowledgements use the configured Make workflow; this does not establish dispatch or guarantee email delivery.",
  returns:
    "For a question about an order, send a support request through Contact and include your order reference. No physical returns are processed through this demonstration store.",
  refunds:
    "No money is collected at checkout, so no monetary refund can be issued. You can record a refund question through Contact. Submitting a request does not change your order status.",
  cancellation:
    "Use Contact or ask Lumi to prepare a cancellation request. Review and submit the request to save it. A request does not automatically cancel an order or change its status.",
  payment:
    "Payment is simulated. Your order is saved with a simulated payment marked complete; no money is charged. Do not enter card or bank details. No products are dispatched.",
};

// Correct only exact inherited policy text; never override new owner-authored text.
// No database writes: both the API and assistant see the same current disclosure.
export function publicPolicy(policy) {
  const original = originals.find((p) => p.slug === policy.slug);
  if (customerCopy[policy.slug] && policy.content === original?.content)
    return { ...policy, content: customerCopy[policy.slug] };
  if (policy.slug !== "privacy" || policy.content !== legacyPrivacy)
    return policy;
  return {
    ...policy,
    content:
      "Use fictional contact and delivery details for this demonstration store. Orders and support requests are saved privately. Cart items stay in your browser. Order status lookup requires the complete order reference and matching checkout email and works from a fresh browser session. It returns limited status and totals, not contact or delivery-address details. Email alone does not grant access. Order-linked support submissions still require the original browser session. Lumi messages and relevant conversation/tool context may be sent to Groq and, on fallback, Google Gemini. Do not include payment information or sensitive medical details. Order acknowledgements use the configured Make workflow; no marketing emails are sent. Support submission does not guarantee an email reply or account recovery.",
  };
}
