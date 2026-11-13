import { z } from "zod";
import { AppError, parse, ticketSchema } from "./validation.js";
import { publicProduct } from "./catalogue.js";
import { publicPolicy } from "./policy-copy.js";
const str = { type: "STRING" };
export const declarations = [
  {
    name: "search_products",
    description:
      "Search the actual GlowLab catalogue. Returns authoritative prices, images and availability. No verified ingredients are available unless marked verified.",
    parameters: {
      type: "OBJECT",
      properties: { query: str, category: str },
      required: ["query"],
    },
  },
  {
    name: "lookup_order",
    description:
      "Look up an order using its reference AND checkout email. Access also requires the originating browser session, independently enforced by the server. Never reveal any other order.",
    parameters: {
      type: "OBJECT",
      properties: { reference: str, email: str },
      required: ["reference", "email"],
    },
  },
  {
    name: "get_store_policy",
    description:
      "Retrieve published store policy, or report that it is not published. No invented rules.",
    parameters: {
      type: "OBJECT",
      properties: { topic: str },
      required: ["topic"],
    },
  },
  {
    name: "create_support_ticket",
    description:
      "Prepare a real support ticket. Requires name, email and issue. Returns a confirmation draft; the customer must explicitly approve using the UI before persistence. Do not claim a ticket exists before approval.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: str,
        email: str,
        issue: str,
        orderReference: str,
        priority: { type: "STRING", enum: ["normal", "high"] },
      },
      required: ["name", "email", "issue"],
    },
  },
  {
    name: "build_skincare_routine",
    description:
      "Select available real catalogue products for a basic AM/PM routine using skin type and maximum total budget in NGN. Ask preferences before calling. Returns actual IDs and reasons; customer approves additions to cart.",
    parameters: {
      type: "OBJECT",
      properties: {
        skinType: str,
        budget: { type: "NUMBER" },
        preferences: str,
      },
      required: ["skinType"],
    },
  },
];
export async function executeTool(
  name,
  args,
  { store, owner, signer, approval },
) {
  switch (name) {
    case "search_products": {
      const a = parse(
        z.object({
          query: z.string().max(200),
          category: z.string().max(100).optional(),
        }),
        args,
      );
      const words = a.query.toLowerCase().split(/\s+/).filter(Boolean);
      const products = (await store.products())
        .filter(
          (p) =>
            (!a.category ||
              p.category.toLowerCase() === a.category.toLowerCase()) &&
            (!words.length ||
              words.some((w) =>
                `${p.name} ${p.brand} ${p.category} ${p.skin_type} ${p.description}`
                  .toLowerCase()
                  .includes(w),
              )),
        )
        .slice(0, 12)
        .map(publicProduct);
      return { products };
    }
    case "lookup_order": {
      const a = parse(
        z.object({
          reference: z.string().trim().min(1).max(80),
          email: z.email().max(254),
        }),
        args,
      );
      const o = await store.order(owner, a.reference, a.email);
      if (!o)
        return {
          error:
            "Order not found or could not be verified. Use the browser that placed the order and the checkout email. Email alone does not establish identity.",
        };
      return {
        reference: o.reference,
        order_status: o.order_status,
        fulfillment_status: o.fulfillment_status,
        subtotal: o.subtotal,
        shipping_fee: o.shipping_fee,
        payment_status: o.payment_status,
        payment_method: o.payment_method,
        total: o.total,
        currency: o.currency,
        items: o.items,
        created_at: o.created_at,
        note: "Demo order; no physical dispatch or real charge.",
      };
    }
    case "get_store_policy": {
      const a = parse(z.object({ topic: z.string().max(100) }), args);
      const policies = (await store.policies()).map(publicPolicy);
      const terms = a.topic.toLowerCase();
      const matches = policies.filter(
        (p) =>
          terms === "all" ||
          `${p.slug} ${p.title}`.toLowerCase().includes(terms),
      );
      return {
        policies: matches,
        ...(!matches.length
          ? {
              note: "No policy published for this topic. Ask for clarification or offer a support ticket.",
            }
          : {}),
      };
    }
    case "create_support_ticket": {
      const draft = parse(ticketSchema, args);
      if (approval)
        return { ticket: await store.ticket(owner, draft, approval.key) };
      if (
        draft.orderReference &&
        !(await store.order(owner, draft.orderReference, draft.email))
      )
        return { error: "Order could not be verified in this browser." };
      return {
        confirmation_required: true,
        draft,
        token: signer.seal({
          kind: "support",
          owner,
          draft,
          key: crypto.randomUUID(),
          expires: Date.now() + 30 * 60 * 1000,
        }),
        note: "Not yet saved. Customer must press Submit ticket in the review card.",
      };
    }
    case "build_skincare_routine": {
      const a = parse(
        z.object({
          skinType: z.string().min(1).max(100),
          budget: z.number().positive().max(10000000).optional(),
          preferences: z.string().max(500).optional(),
        }),
        args,
      );
      const all = (await store.products())
        .map(publicProduct)
        .filter((p) => p.available);
      let remaining = a.budget ?? Infinity;
      const selected = [];
      const categories = ["Cleansers", "Moisturizers", "Sunscreens"];
      for (const category of categories) {
        const candidates = all
          .filter((p) => p.category === category)
          .sort((x, y) => x.price - y.price);
        const cheapestRest = categories
          .slice(categories.indexOf(category) + 1)
          .reduce(
            (s, c) =>
              s +
              (all
                .filter((p) => p.category === c)
                .sort((x, y) => x.price - y.price)[0]?.price ?? 0),
            0,
          );
        const fits = candidates.filter(
          (p) => p.price + cheapestRest <= remaining,
        );
        const p =
          fits.find((p) =>
            p.skin_type?.toLowerCase().includes(a.skinType.toLowerCase()),
          ) || fits[0];
        if (p) {
          remaining -= p.price;
          selected.push({
            ...p,
            reason: `${category === "Sunscreens" ? "Morning sun-protection step" : category === "Cleansers" ? "Cleansing step" : "Moisturizing step"} from the existing catalogue; ${p.skin_type} is the catalogue skin-type label, not a medical assessment.`,
          });
        }
      }
      const ids = selected.map((p) => p.id);
      return {
        products: selected,
        routine: {
          morning: ids,
          evening: selected
            .filter((p) => p.category !== "Sunscreens")
            .map((p) => p.id),
          total: selected.reduce((s, p) => s + p.price, 0),
          budget: a.budget ?? null,
          preferences: a.preferences || "",
          incomplete: selected.length < 3,
          note: "Basic shopping suggestion, not a diagnosis. Detailed ingredients and usage are unverified. Read the packaging, patch test, and consult a qualified professional about persistent or concerning symptoms. Preferences cannot be certified without verified product details. No products have been added to cart.",
        },
      };
    }
    default:
      throw new AppError(400, "Unknown assistant function.");
  }
}
