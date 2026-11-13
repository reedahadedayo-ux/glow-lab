/* Customer-facing presentation only. Never changes API payloads or stored records. */
"use strict";
(() => {
  const legacyPolicies = [
    {
      slug: "delivery",
      original:
        "This is a demonstration. No products are physically dispatched. The original storefront described Lagos delivery in 1–3 business days and outside Lagos in 3–7 business days; these are illustrative, not a shipping commitment. Demo delivery fee is ₦0. No courier tracking, SMS or email is sent.",
      title: "Delivery",
      content:
        "No products are dispatched through this demonstration checkout. Delivery dates and courier tracking are not available. The delivery amount shown at checkout is not a free-shipping offer.",
    },
    {
      slug: "returns",
      original:
        "The original demo policy allows unopened products in original packaging within 7 days of delivery. Opened skincare is excluded unless damaged in transit. Report damage within 48 hours. In this demo, submit a support ticket; no physical return is processed.",
      title: "Returns",
      content:
        "For a question about an order, send a support request through Contact and include your order reference. No physical returns are processed through this demonstration store.",
    },
    {
      slug: "refunds",
      original:
        "No money is collected, so no monetary refund can be issued. A refund request can be recorded as a support ticket. No real-world refund time frame is published.",
      title: "Refunds",
      content:
        "No money is collected at checkout, so no monetary refund can be issued. You can record a refund question through Contact. Submitting a request does not change your order status.",
    },
    {
      slug: "cancellation",
      original:
        "Ask Lumi or use Contact to record a cancellation request. A request does not automatically change an order status. No real-world cancellation deadline is published.",
      title: "Cancellation requests",
      content:
        "Use Contact or ask Lumi to prepare a cancellation request. Review and submit the request to save it. A request does not automatically cancel an order or change its status.",
    },
    {
      slug: "payment",
      original:
        "Checkout creates a demo order with payment_status paid, payment_method simulated and order_status confirmed. No real money is charged. Do not enter card or bank details.",
      title: "Payment",
      content:
        "Payment is simulated. Your order is saved with a simulated payment marked complete; no money is charged. Do not enter card or bank details. No products are dispatched.",
    },
    {
      slug: "privacy",
      original:
        "Use fictional delivery details for this demo. Orders are accessible only from the browser session that created them, with the checkout email for order lookup. Losing the browser session requires support; email alone does not unlock an order. Lumi messages are sent to Google Gemini to answer your request. Do not share sensitive medical or payment information. Cart data stays in your browser. Support tickets and demo orders are saved in the configured database. No marketing emails are sent.",
      title: "Privacy & store information",
      content:
        "Use fictional contact and delivery details for this demonstration store. The details you submit with orders and support requests are saved. Cart items are stored in your browser. Order lookup requires the browser session that placed the order and the checkout email; email alone does not grant access. If that session is lost, use Contact to record a support request; recovery is not guaranteed. Lumi messages and relevant context may be sent to Groq and, on fallback, Google Gemini. Do not include payment information or sensitive medical details. Order acknowledgements use the configured Make workflow; no marketing emails are sent.",
    },
  ];
  function productDescription(product) {
    const kind = product.category.toLowerCase().replace(/s$/, "");
    const legacy = `${product.brand} ${kind} from the existing GlowLab demo catalogue.`;
    return product.description === legacy
      ? `${product.brand} ${kind}. View the product details before choosing.`
      : product.description;
  }
  function policy(policy) {
    const legacy = legacyPolicies.find(
      (p) => p.slug === policy.slug && p.original === policy.content,
    );
    return legacy
      ? { ...policy, title: legacy.title, content: legacy.content }
      : policy;
  }
  function status(value) {
    return (
      {
        confirmed: "Confirmed",
        pending: "Pending",
        paid: "Paid",
        failed: "Failed",
        cancelled: "Cancelled",
        unfulfilled: "Not dispatched",
        fulfilled: "Fulfilled",
        shipped: "Shipped",
        delivered: "Delivered",
        open: "Open",
      }[value] ||
      value ||
      "Not available"
    );
  }
  function payment(order) {
    if (order.payment_method === "simulated") {
      return order.payment_status === "paid"
        ? "Simulation complete · no money charged"
        : `${status(order.payment_status)} · simulated payment`;
    }
    return status(order.payment_status);
  }
  window.GlowLabCopy = Object.freeze({
    productDescription,
    policy,
    status,
    payment,
  });
})();
