import { AppError } from "./validation.js";

// Error messages exposed to customers never contain SQL, headers, keys or upstream bodies.
export function databaseError(error, status, operation) {
  if (!error) return null;
  const pg = error.code || "";
  if (pg === "P0001")
    return new AppError(409, error.message, "CART_OR_REQUEST_CONFLICT");
  let code = "DATABASE_UNAVAILABLE",
    message =
      "The store could not reach its database. Please retry; your cart has been kept.";
  if (
    status === 0 ||
    /fetch failed|network|timeout|abort/i.test(error.message || "")
  ) {
    code = "DATABASE_NETWORK";
    message =
      "The store is having trouble connecting. Please try again shortly. Your cart is safe; no successful order has been confirmed.";
  } else if (pg === "PGRST106") {
    code = "DATABASE_SCHEMA_NOT_EXPOSED";
    message =
      "The store database connection needs attention. Please try again later.";
  } else if (["PGRST205", "42P01", "42703", "PGRST202"].includes(pg)) {
    code = "DATABASE_SCHEMA_MISMATCH";
    message = "The store is being updated. Please try again shortly.";
  } else if (
    status === 401 ||
    ["PGRST301", "PGRST302", "PGRST303", "28P01"].includes(pg)
  ) {
    code = "DATABASE_CREDENTIALS";
    message =
      "The store database connection needs attention. Please try again later.";
  } else if (status === 403 || pg === "42501") {
    code = "DATABASE_PERMISSIONS";
    message =
      "The store database connection needs attention. Please try again later.";
  }
  const result = new AppError(503, message, code);
  result.diagnostic = {
    event: "database_request_failed",
    operation,
    category: code,
    upstreamStatus: status || 0,
    upstreamCode: pg || null,
  };
  return result;
}
