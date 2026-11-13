// Explicit, insert-only demo seed; NEVER run before auditing the EXISTING project.
import { createClient } from "@supabase/supabase-js";
import { catalogue } from "../server/catalogue.js";
import policies from "../data/policies.json" with { type: "json" };
if (!process.argv.includes("--existing-project-reviewed"))
  throw new Error(
    "Inspect the existing Supabase project and reconcile its catalogue/schema first. Then pass --existing-project-reviewed only if this isolated demo seed is appropriate.",
  );
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Configure the EXISTING project server credentials.");
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: process.env.SUPABASE_DB_SCHEMA || "glowlab" },
    auth: { persistSession: false },
  },
);
for (const [table, rows, key] of [
  [
    "categories",
    [...new Set(catalogue.map((p) => p.category))].map((name) => ({ name })),
    "name",
  ],
  ["products", catalogue, "id"],
  ["store_policies", policies.map((p) => ({ ...p, published: true })), "slug"],
]) {
  const { error } = await db
    .from(table)
    .upsert(rows, { onConflict: key, ignoreDuplicates: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(
    `${table}: inserted missing demo records only; existing values preserved.`,
  );
}
