import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  createGroqClient,
  groqMessages,
  groqModel,
  normalizeGroq,
} from "../server/groq.js";
import { respond } from "../server/lumi.js";
import { signer } from "../server/security.js";
import { redactSecrets } from "../server/secret-safety.js";
import { createApp } from "../server/app.js";
const secret = "provider-tests-only-not-a-real-session-secret";
const base = {
  env: {},
  signer: signer(secret),
  owner: "test-owner",
  store: {},
  message: "Hello",
  observeProvider() {},
};
const fail = (status) => ({
  models: {
    async generateContent() {
      throw Object.assign(new Error("private provider error"), { status });
    },
  },
});
const answer = (text) => ({
  models: {
    async generateContent() {
      return { text };
    },
  },
});
const reply = (text) => ({
  choices: [{ finish_reason: "stop", message: { content: text } }],
});
const rawCall = (id = "call-1", args = '{"query":"cleanser"}') => ({
  choices: [
    {
      finish_reason: "tool_calls",
      message: {
        tool_calls: [
          {
            id,
            type: "function",
            function: { name: "search_products", arguments: args },
          },
        ],
      },
    },
  ],
});

test("Groq REST adapter uses server credential, selected model, lowercase tools, automatic selection and bounded request", async () => {
  let seen;
  const key = "provider-test-only-groq-key-not-a-credential";
  const client = createGroqClient({ GROQ_API_KEY: key }, async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return Response.json(reply("Hello from transport mock"));
  });
  const result = await client.models.generateContent({
    contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    config: {
      systemInstruction: "policy",
      tools: [
        {
          functionDeclarations: [
            {
              name: "search_products",
              parameters: {
                type: "OBJECT",
                properties: { query: { type: "STRING" } },
              },
            },
          ],
        },
      ],
      httpOptions: { timeout: 1000 },
    },
  });
  assert.equal(result.text, "Hello from transport mock");
  assert.equal(seen.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(seen.init.headers.Authorization, `Bearer ${key}`);
  assert.equal(seen.body.model, "openai/gpt-oss-20b");
  assert.equal(
    groqModel({ GROQ_MODEL: "configured-model" }),
    "configured-model",
  );
  assert.equal(
    seen.body.tools[0].function.parameters.properties.query.type,
    "string",
  );
  assert.equal(seen.body.tool_choice, "auto");
  assert.equal(seen.body.parallel_tool_calls, false);
  assert.equal(seen.init.redirect, "error");
  assert.ok(seen.init.signal instanceof AbortSignal);
});

test("successful Groq generation returns compatible response/history and never calls Gemini (mock)", async () => {
  const events = [];
  const result = await respond({
    ...base,
    groqClient: answer("Primary response"),
    modelClient: fail(401),
    observeProvider: (e) => events.push(e),
  });
  assert.equal(result.text, "Primary response");
  assert.deepEqual(
    events.map((e) => e.provider),
    ["groq"],
  );
  assert.equal(base.signer.open(result.historyToken).owner, base.owner);
  assert.deepEqual(result.products, []);
});

test("provider error, quota, missing model, auth and network outage all fall back to successful Gemini (mock)", async () => {
  for (const status of [0, 400, 401, 403, 404, 422, 429, 500, 502, 503, 504]) {
    const events = [];
    const result = await respond({
      ...base,
      groqClient: fail(status),
      modelClient: answer("Fallback response"),
      observeProvider: (e) => events.push(e),
    });
    assert.equal(result.text, "Fallback response");
    assert.deepEqual(
      events.map((e) => [e.provider, e.outcome]),
      [
        ["groq", "fallback"],
        ["gemini", "success"],
      ],
    );
    assert.equal(events[0].upstreamStatus, status);
  }
});

test("fallback after a completed tool preserves results, deduplicates repeated identical calls and stays sticky (mock)", async () => {
  let primaryCalls = 0,
    fallbackCalls = 0,
    reads = 0;
  const tools = [];
  const result = await respond({
    ...base,
    message: "Find cleanser",
    store: {
      products: async () => {
        reads++;
        return [];
      },
    },
    observeTool: (e) => tools.push(e),
    groqClient: {
      models: {
        async generateContent() {
          if (++primaryCalls === 1) return normalizeGroq(rawCall());
          throw Object.assign(new Error("outage after tool"), { status: 503 });
        },
      },
    },
    modelClient: {
      models: {
        async generateContent(input) {
          assert.ok(
            input.contents.some((c) =>
              c.parts.some(
                (p) => p.functionResponse?.name === "search_products",
              ),
            ),
          );
          if (++fallbackCalls === 1)
            return normalizeGroq(rawCall("fallback-id"));
          return { text: "No matching products." };
        },
      },
    },
  });
  assert.equal(result.text, "No matching products.");
  assert.equal(primaryCalls, 2);
  assert.equal(fallbackCalls, 2);
  assert.equal(reads, 1);
  assert.equal(tools.length, 1);
});

test("canonical history converts legacy Gemini and Groq tool IDs with matching tool responses", () => {
  const messages = groqMessages(
    [
      { role: "user", parts: [{ text: "find" }] },
      {
        role: "model",
        parts: [
          {
            functionCall: {
              name: "search_products",
              args: { query: "cleanser" },
            },
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "search_products",
              response: { products: [] },
            },
          },
        ],
      },
      { role: "model", parts: [{ text: "None found." }] },
    ],
    "policy",
  );
  assert.equal(messages[2].tool_calls[0].id, messages[3].tool_call_id);
  assert.equal(messages[3].role, "tool");
  assert.equal(messages[4].content, "None found.");
});

test("malformed tool JSON, duplicate call IDs and empty/truncated Groq responses are rejected before tools execute", async () => {
  for (const body of [
    rawCall("id", "invalid-json"),
    rawCall("id", "[]"),
    reply(""),
    { choices: [{ finish_reason: "length", message: { content: "partial" } }] },
  ]) {
    const groqClient = createGroqClient(
      { GROQ_API_KEY: "test-only-not-a-real-key" },
      async () => Response.json(body),
    );
    const result = await respond({
      ...base,
      groqClient,
      modelClient: answer("Safe fallback"),
    });
    assert.equal(result.text, "Safe fallback");
  }
  const duplicate = rawCall();
  duplicate.choices[0].message.tool_calls.push(
    duplicate.choices[0].message.tool_calls[0],
  );
  assert.throws(() => normalizeGroq(duplicate));
});

test("both unavailable produce a friendly non-success response without raw errors or secrets", async () => {
  await assert.rejects(
    respond({ ...base, groqClient: fail(429), modelClient: fail(503) }),
    (error) => {
      assert.equal(error.status, 503);
      assert.match(error.message, /temporarily unavailable/);
      assert.doesNotMatch(JSON.stringify(error), /private provider error/);
      return true;
    },
  );
});

test("Groq secrets are redacted recursively and no browser file contains provider credentials or endpoints", () => {
  const env = { GROQ_API_KEY: "test-only-groq-canary-not-a-real-credential" };
  const output = JSON.stringify(
    redactSecrets(
      { [env.GROQ_API_KEY]: [env.GROQ_API_KEY, "gsk_" + "Z".repeat(40)] },
      env,
    ),
  );
  assert.doesNotMatch(output, /canary|gsk_/);
  for (const file of [
    ...readdirSync("js").map((f) => `js/${f}`),
    ...readdirSync(".").filter((f) => f.endsWith(".html")),
  ])
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /GROQ_API_KEY|api\.groq\.com|gsk_[\w-]{20,}/,
    );
});

test("HTTP Lumi contract delivers primary/fallback and honest dual failure through the unchanged frontend endpoint", async () => {
  for (const scenario of ["primary", "fallback", "unavailable"]) {
    const app = createApp({
      env: {},
      secret,
      store: {},
      observeProvider() {},
      groqClient:
        scenario === "primary" ? answer("Primary response") : fail(503),
      modelClient:
        scenario === "unavailable" ? fail(503) : answer("Fallback response"),
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/lumi`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Hello" }),
        },
      );
      const body = await response.json();
      assert.equal(response.status, scenario === "unavailable" ? 503 : 200);
      if (response.ok) {
        assert.ok(body.text);
        assert.ok(body.historyToken);
        assert.ok(Array.isArray(body.products));
      } else assert.match(body.error, /temporarily unavailable/);
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  }
});
