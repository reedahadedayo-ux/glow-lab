import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { AppError } from "./validation.js";
export function signer(secret) {
  const sign = (s) =>
    createHmac("sha256", secret).update(s).digest("base64url");
  return {
    seal(data) {
      const value = Buffer.from(JSON.stringify(data)).toString("base64url");
      return `${value}.${sign(value)}`;
    },
    open(token) {
      if (typeof token !== "string" || token.length > 100000)
        throw new AppError(
          400,
          "Invalid or expired session data. Start a new conversation.",
        );
      const [value, mac] = token.split(".");
      const expected = sign(value || "");
      if (
        !mac ||
        mac.length !== expected.length ||
        !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
      )
        throw new AppError(
          400,
          "Invalid session data. Start a new conversation.",
        );
      let data;
      try {
        data = JSON.parse(Buffer.from(value, "base64url"));
      } catch {
        throw new AppError(400, "Invalid session data.");
      }
      if (data.expires < Date.now())
        throw new AppError(
          400,
          "Session data expired. Start a new conversation.",
        );
      return data;
    },
    owner(cookie) {
      return sign(`owner:${cookie}`);
    },
    cookie() {
      return randomBytes(32).toString("hex");
    },
  };
}
