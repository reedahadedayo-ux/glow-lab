// Read-only preflight. Never prints keys, tokens, email, private records or raw upstream bodies.
import { lookup } from "node:dns/promises";
import { SupabaseStore } from "../server/supabase-store.js";
const env = process.env;
const report = {
  checkedAt: new Date().toISOString(),
  backend: env.DATA_BACKEND || "supabase",
  configuration: "not_checked",
  dns: "not_checked",
  transport: "not_checked",
  catalogue: "not_checked",
};
try {
  if (env.DATA_BACKEND === "local")
    throw new Error(
      "This probe requires Supabase mode; local fallback is not allowed.",
    );
  const store = new SupabaseStore(env, {
    fetch: async (url, options) => {
      try {
        const response = await fetch(url, options);
        report.transport = "http_response_received";
        report.httpStatus = response.status;
        return response;
      } catch (error) {
        report.transport = "failed_before_http_response";
        report.networkCode = [
          "ECONNRESET",
          "ENOTFOUND",
          "EAI_AGAIN",
          "ETIMEDOUT",
          "UND_ERR_CONNECT_TIMEOUT",
        ].includes(error.cause?.code)
          ? error.cause.code
          : error.name === "TimeoutError"
            ? "TIMEOUT"
            : "FETCH_FAILED";
        throw error;
      }
    },
  });
  report.configuration = "valid";
  report.projectHost = new URL(env.SUPABASE_URL).hostname;
  report.schema = env.SUPABASE_DB_SCHEMA || "glowlab";
  try {
    await lookup(report.projectHost);
    report.dns = "resolved";
  } catch {
    report.dns = "failed";
  }
  const products = await store.products();
  report.catalogue = products.length ? "readable" : "empty";
  report.productCount = products.length;
  report.ready = products.length > 0;
  if (!report.ready) process.exitCode = 1;
} catch (error) {
  report.ready = false;
  report.errorCode = error.code || "SERVER_CONFIGURATION";
  if (report.configuration !== "valid") report.configuration = "invalid";
  process.exitCode = 1;
}
console.log(JSON.stringify(report, null, 2));
