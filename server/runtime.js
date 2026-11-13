import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createApp } from "./app.js";
import { SupabaseStore } from "./supabase-store.js";
export async function runtime(env = process.env) {
  let store,
    secret = env.SESSION_SECRET;
  if (env.DATA_BACKEND && !["local", "supabase"].includes(env.DATA_BACKEND))
    throw new Error(
      "DATA_BACKEND must be supabase or explicit development-only local mode.",
    );
  if (env.DATA_BACKEND === "local") {
    if (env.VERCEL || env.NODE_ENV === "production")
      throw new Error(
        "Local SQLite mode is development-only; use the existing Supabase project for deployment.",
      );
    const { LocalStore } = await import("./local-store.js");
    store = new LocalStore();
    if (!secret) {
      mkdirSync(".data", { recursive: true });
      try {
        secret = readFileSync(".data/session-secret", "utf8");
      } catch {
        secret = randomBytes(32).toString("hex");
        writeFileSync(".data/session-secret", secret, { mode: 0o600 });
      }
    }
  } else if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
    store = new SupabaseStore(env);
  if (!secret || secret.length < 32) {
    if (env.NODE_ENV === "production" || env.VERCEL)
      throw new Error("Set a stable SESSION_SECRET of at least 32 characters.");
    mkdirSync(".data", { recursive: true });
    try {
      secret = readFileSync(".data/session-secret", "utf8");
    } catch {
      secret = randomBytes(32).toString("hex");
      writeFileSync(".data/session-secret", secret, { mode: 0o600 });
    }
  }
  return createApp({ store, env, secret });
}
