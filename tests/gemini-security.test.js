import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { redactSecrets } from "../server/secret-safety.js";
import { respond, geminiModel } from "../server/lumi.js";
import { signer } from "../server/security.js";
import { createApp } from "../server/app.js";
const key = "test-only-gemini-secret-canary-not-a-real-key";
const secret = "test-only-session-secret-over-32-characters";
const env = {
  GEMINI_API_KEY: key,
  SESSION_SECRET: secret,
  DATA_BACKEND: "supabase",
};
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );

test("frontend has no SDK import, Google API endpoint or public key variable; official SDK is backend dependency", () => {
  for (const file of [
    ...walk("js"),
    ...readdirSync(".").filter((p) => p.endsWith(".html")),
  ]) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /@google\/genai|generativelanguage\.googleapis\.com|GEMINI_API_KEY|GOOGLE_API_KEY|AIza[\w-]{30,}/.test(
        text,
      ),
      false,
      file,
    );
  }
  assert.ok(
    JSON.parse(readFileSync("package.json", "utf8")).dependencies[
      "@google/genai"
    ],
  );
  assert.equal(geminiModel({}), "gemini-2.5-flash");
});

test("exact backend secrets and Google-key patterns are redacted recursively without modifying the environment", () => {
  const value = {
    text: key,
    nested: [{ text: secret }],
    google: "AIza" + "Z".repeat(35),
  };
  const cleaned = JSON.stringify(redactSecrets(value, env));
  assert.equal(cleaned.includes(key), false);
  assert.equal(cleaned.includes(secret), false);
  assert.equal(cleaned.includes("AIza"), false);
  assert.equal(env.GEMINI_API_KEY, key);
});

test("SDK exception never returns raw error/key; safe category retains upstream status (mock exception, not live)", async () => {
  await assert.rejects(
    respond({
      message: "hello",
      env,
      owner: "owner",
      signer: signer(secret),
      store: {},
      modelClient: {
        models: {
          generateContent: async () => {
            throw Object.assign(new Error(`private upstream message ${key}`), {
              status: 403,
            });
          },
        },
      },
    }),
    (error) => {
      assert.equal(error.code, "GEMINI_AUTH");
      assert.equal(error.diagnostic.upstreamStatus, 403);
      assert.equal(JSON.stringify(error).includes(key), false);
      assert.equal(error.message.includes(key), false);
      return true;
    },
  );
});

test("model text and signed history redact backend secrets before reaching browser (mock model, not live)", async () => {
  const s = signer(secret);
  const result = await respond({
    message: "hello",
    env,
    owner: "owner",
    signer: s,
    store: {},
    modelClient: {
      models: {
        generateContent: async () => ({ text: `Do not expose ${key}` }),
      },
    },
  });
  assert.equal(result.text.includes(key), false);
  assert.equal(
    JSON.stringify(s.open(result.historyToken)).includes(key),
    false,
  );
});

test("API responses and diagnostic logs never expose key, including a malicious echoed upstream message (mock fault)", async () => {
  const logs = [];
  const previous = console.error;
  console.error = (value) => logs.push(String(value));
  const fault = Object.assign(new Error("unexpected " + key), {
    status: 503,
    diagnostic: { event: "failure", raw: key },
  });
  const app = createApp({
    env,
    secret,
    store: {
      products: async () => {
        throw fault;
      },
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const config = await (await fetch(base + "/api/config")).text();
    assert.equal(config.includes(key), false);
    assert.equal(JSON.parse(config).gemini, true);
    const response = await fetch(base + "/api/products");
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes(key), false);
    assert.equal(logs.join("").includes(key), false);
  } finally {
    console.error = previous;
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
