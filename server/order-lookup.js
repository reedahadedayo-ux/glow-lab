import { withDeadline } from "./request-deadline.js";
import { z } from "zod";
import { AppError } from "./validation.js";

export const normalizedEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));
// Existing references are GL- plus random hexadecimal characters. Accept historical lengths,
// never partial matches, SQL wildcards or an email-only search.
export const orderLookupSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^GL-[A-Z0-9]{4,64}$/),
    email: normalizedEmail,
  })
  .strict();

export function orderSummary(order) {
  if (!order) return null;
  return Object.fromEntries(
    [
      "reference",
      "order_status",
      "fulfillment_status",
      "payment_status",
      "payment_method",
      "subtotal",
      "shipping_fee",
      "total",
      "currency",
      "created_at",
    ].map((key) => [key, order[key]]),
  );
}

export async function verifyOrder(store, input, { timeoutMs = 8000 } = {}) {
  const parsed = orderLookupSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      400,
      "Enter a complete GlowLab order reference and a valid checkout email.",
      "ORDER_LOOKUP_INVALID",
    );
  const { reference, email } = parsed.data;
  let order;
  try {
    order = await withDeadline(
      () => store.verifiedOrder(reference, email),
      timeoutMs,
    );
  } catch (error) {
    if (["TimeoutError", "AbortError"].includes(error.name))
      throw new AppError(
        504,
        "Order verification timed out. Please try again; no order status was verified.",
        "ORDER_LOOKUP_TIMEOUT",
      );
    throw new AppError(
      503,
      "Order verification is temporarily unavailable. Please try again later; no order status was verified.",
      error instanceof AppError && error.code.startsWith("DATABASE_")
        ? error.code
        : "DATABASE_UNAVAILABLE",
    );
  }
  if (!order)
    throw new AppError(
      404,
      "We couldn't verify that order. Check the complete reference and checkout email, or use Contact for help.",
      "ORDER_NOT_VERIFIED",
    );
  return orderSummary(order);
}

// Shared by direct lookup and model tool calls: changing cookies does not reset attempts.
// Process-local by design, like the existing API limiters. Distributed enforcement is a
// production prerequisite for multiple serverless instances; no paid store is added here.
export function createLookupGuard({
  limit = 10,
  windowMs = 60000,
  now = Date.now,
} = {}) {
  const buckets = new Map();
  return (key) => {
    const time = now();
    for (const [id, entry] of buckets)
      if (entry.reset <= time) buckets.delete(id);
    let entry = buckets.get(key);
    if (!entry) {
      // Fail closed rather than allowing unbounded memory allocation.
      if (buckets.size >= 10000)
        throw new AppError(
          429,
          "Order lookup is busy. Please wait a minute.",
          "ORDER_LOOKUP_LIMIT",
        );
      entry = { count: 0, reset: time + windowMs };
      buckets.set(key, entry);
    }
    if (++entry.count > limit)
      throw new AppError(
        429,
        "Too many order lookup attempts. Wait a minute before trying again.",
        "ORDER_LOOKUP_LIMIT",
      );
  };
}
