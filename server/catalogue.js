import original from "../data/catalogue-original.json" with { type: "json" };
// Preserve existing IDs/prices/photos. Original marketing/ingredient copy is not verified.
// It stays in the source snapshot, not in customer recommendations.
export const catalogue = original.map((p) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  price: p.price,
  image: p.image,
  category: p.category,
  skin_type: p.skinType,
  description: `${p.brand} ${p.category.toLowerCase().replace(/s$/, "")} from the existing GlowLab demo catalogue.`,
  ingredients: [],
  usage: null,
  details_verified: false,
  available: true,
  stock: null,
}));
export function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: Number(p.price),
    image: p.image,
    category: p.category,
    skin_type: p.skin_type,
    description: p.description,
    ingredients: p.details_verified ? p.ingredients || [] : [],
    usage: p.details_verified ? p.usage : null,
    details_verified: !!p.details_verified,
    available: p.available === true && (p.stock === null || p.stock > 0),
    stock: p.stock,
  };
}
