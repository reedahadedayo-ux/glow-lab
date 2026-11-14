import { z } from "zod";
export class AppError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const text = (min, max) => z.string().trim().min(min).max(max);
export const customerSchema = z.object({
  name: text(2, 100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email())
    .transform((s) => s.toLowerCase()),
  phone: text(7, 30).regex(/^\+?[\d ()-]+$/),
  address: text(5, 300),
  city: text(2, 100),
  instructions: text(0, 500).optional().default(""),
});
export const cartSchema = z
  .array(
    z
      .object({
        productId: text(1, 100),
        quantity: z.number().int().min(1).max(20),
      })
      .strict(),
  )
  .min(1)
  .max(30)
  .refine(
    (a) => new Set(a.map((i) => i.productId)).size === a.length,
    "Duplicate product IDs",
  );
export const checkoutSchema = z
  .object({
    customer: customerSchema,
    items: cartSchema,
    idempotencyKey: z.uuid(),
  })
  .strict();
export const ticketSchema = z
  .object({
    name: text(2, 100),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    issue: text(10, 3000),
    orderReference: text(0, 80).optional().default(""),
    priority: z.enum(["normal", "high"]).default("normal"),
  })
  .strict();
export function parse(schema, input) {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new AppError(
      400,
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return r.data;
}
export function priceCart(products, items) {
  return items.map((i) => {
    const p = products.find((p) => p.id === i.productId);
    if (!p || !p.available || (p.stock !== null && p.stock < i.quantity))
      throw new AppError(
        409,
        "A product is unavailable or has insufficient stock. Please review your cart.",
      );
    return {
      product_id: p.id,
      product_name: p.name,
      quantity: i.quantity,
      unit_price: Number(p.price),
      line_total: (Math.round(Number(p.price) * 100) * i.quantity) / 100,
    };
  });
}
