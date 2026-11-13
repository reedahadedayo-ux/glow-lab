// Defense in depth: values are only read server-side and never emitted by this helper.
export function redactSecrets(value, env = process.env) {
  const secrets = [
    env.GEMINI_API_KEY,
    env.GROQ_API_KEY,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.SESSION_SECRET,
  ].filter((s) => typeof s === "string" && s.length >= 8);
  const clean = (input) => {
    if (typeof input === "string") {
      let output = input;
      for (const secret of secrets)
        output = output.split(secret).join("[REDACTED]");
      return output.replace(
        /AIza[\w-]{30,}|gsk_[A-Za-z0-9_-]{20,}/g,
        "[REDACTED]",
      );
    }
    if (Array.isArray(input)) return input.map(clean);
    if (input && typeof input === "object")
      return Object.fromEntries(
        Object.entries(input).map(([key, v]) => [clean(key), clean(v)]),
      );
    return input;
  };
  return clean(value);
}
