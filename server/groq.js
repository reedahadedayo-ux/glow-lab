// Server-only Groq REST adapter. Canonical history remains compatible with Gemini.
export const groqModel = (env = process.env) =>
  env.GROQ_MODEL || "openai/gpt-oss-20b";

export class ProviderFailure extends Error {
  constructor(status = 0) {
    super("Assistant provider request failed");
    this.status = status;
  }
}

export function jsonSchema(value) {
  if (Array.isArray(value)) return value.map(jsonSchema);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        key === "type" && typeof v === "string"
          ? v.toLowerCase()
          : jsonSchema(v),
      ]),
    );
  return value;
}

export function groqMessages(contents, instruction) {
  const messages = [{ role: "system", content: instruction }];
  const pending = [];
  for (const [index, content] of contents.entries()) {
    const parts = content.parts || [];
    const calls = parts
      .filter((p) => p.functionCall)
      .map((p, i) => {
        const c = p.functionCall;
        const id = c.id || `gl_${index}_${i}`;
        pending.push({ id, name: c.name });
        return {
          id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.args || {}) },
        };
      });
    const text = parts
      .filter((p) => typeof p.text === "string")
      .map((p) => p.text)
      .join("\n");
    if (calls.length || content.role === "model")
      messages.push({
        role: "assistant",
        content: text || null,
        ...(calls.length ? { tool_calls: calls } : {}),
      });
    else if (text) messages.push({ role: "user", content: text });
    for (const part of parts.filter((p) => p.functionResponse)) {
      const r = part.functionResponse;
      const at = pending.findIndex((c) =>
        r.id ? c.id === r.id : c.name === r.name,
      );
      if (at < 0) throw new ProviderFailure(400);
      const [call] = pending.splice(at, 1);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: r.name,
        content: JSON.stringify(r.response),
      });
    }
  }
  return messages;
}

export function normalizeGroq(body) {
  const choice = body?.choices?.[0];
  const message = choice?.message;
  if (!message || choice.finish_reason === "length")
    throw new ProviderFailure(502);
  const raw = message.tool_calls;
  if (raw !== undefined && !Array.isArray(raw)) throw new ProviderFailure(502);
  if (raw?.length) {
    if (raw.length > 5) throw new ProviderFailure(502);
    const seen = new Set();
    const calls = raw.map((c) => {
      if (
        c.type !== "function" ||
        typeof c.id !== "string" ||
        !c.id ||
        seen.has(c.id) ||
        typeof c.function?.name !== "string" ||
        typeof c.function.arguments !== "string" ||
        c.function.arguments.length > 20000
      )
        throw new ProviderFailure(502);
      seen.add(c.id);
      let args;
      try {
        args = JSON.parse(c.function.arguments);
      } catch {
        throw new ProviderFailure(502);
      }
      if (!args || typeof args !== "object" || Array.isArray(args))
        throw new ProviderFailure(502);
      return { id: c.id, name: c.function.name, args };
    });
    return {
      functionCalls: calls,
      candidates: [
        {
          content: {
            role: "model",
            parts: calls.map((functionCall) => ({ functionCall })),
          },
        },
      ],
    };
  }
  if (typeof message.content !== "string" || !message.content.trim())
    throw new ProviderFailure(502);
  return { text: message.content.trim() };
}

export function createGroqClient(env, transport = globalThis.fetch) {
  return {
    models: {
      async generateContent(input) {
        if (!env.GROQ_API_KEY) throw new ProviderFailure(503);
        const body = {
          model: groqModel(env),
          messages: groqMessages(
            input.contents,
            input.config.systemInstruction,
          ),
          tools: input.config.tools[0].functionDeclarations.map((d) => ({
            type: "function",
            function: jsonSchema(d),
          })),
          tool_choice: "auto",
          parallel_tool_calls: false,
          temperature: 0.2,
          max_completion_tokens: 3000,
        };
        let response;
        try {
          response = await transport(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
              signal: input.config.abortSignal
                ? AbortSignal.any([
                    input.config.abortSignal,
                    AbortSignal.timeout(input.config.httpOptions.timeout),
                  ])
                : AbortSignal.timeout(input.config.httpOptions.timeout),
              redirect: "error",
            },
          );
        } catch {
          throw new ProviderFailure(0);
        }
        // Never log or attach the raw error body (which may contain request data).
        if (!response.ok) throw new ProviderFailure(response.status);
        try {
          return normalizeGroq(await response.json());
        } catch {
          throw new ProviderFailure(502);
        }
      },
    },
  };
}
