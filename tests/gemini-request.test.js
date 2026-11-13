import test from "node:test";
import assert from "node:assert/strict";
import { generateWithRecovery } from "../server/gemini-request.js";
import { respond } from "../server/lumi.js";
import { signer } from "../server/security.js";

test("transient 502/503/504 generation errors retry once with bounded timeout", async () => {
  for (const status of [502, 503, 504]) {
    let calls = 0;
    const inputs = [];
    const ai = {
      models: {
        generateContent: async (input) => {
          inputs.push(input);
          if (++calls === 1)
            throw Object.assign(new Error("upstream failure"), { status });
          return { text: "recovered" };
        },
      },
    };
    const result = await generateWithRecovery(
      ai,
      { contents: "hello", config: { temperature: 0.2 } },
      90000,
      () => 0,
    );
    assert.equal(result.text, "recovered");
    assert.equal(calls, 2);
    assert.equal(inputs[0].config.httpOptions.timeout, 40000);
    assert.deepEqual(inputs[0], inputs[1]);
  }
});
test("auth/model/request/quota errors are not retried; repeated outages stop after two attempts", async () => {
  for (const status of [400, 401, 403, 404, 429, 503]) {
    let calls = 0;
    const error = Object.assign(new Error("upstream failure"), { status });
    const ai = {
      models: {
        generateContent: async () => {
          calls++;
          throw error;
        },
      },
    };
    await assert.rejects(
      generateWithRecovery(ai, {}, 90000, () => 0),
      (e) => e === error,
    );
    assert.equal(calls, status === 503 ? 2 : 1);
  }
});
test("shared deadline bounds later rounds and prevents requests after expiry", async () => {
  let timeout;
  const ai = {
    models: {
      generateContent: async (input) => {
        timeout = input.config.httpOptions.timeout;
        return { text: "ok" };
      },
    },
  };
  await generateWithRecovery(ai, {}, 90000, () => 85000);
  assert.equal(timeout, 5000);
  await assert.rejects(
    generateWithRecovery(ai, {}, 90000, () => 90000),
    { name: "TimeoutError" },
  );
});
test("generation retry after a tool result does not rerun the tool (mock transport)", async () => {
  let calls = 0,
    reads = 0;
  const result = await respond({
    message: "find cleanser",
    owner: "test",
    signer: signer("test-only-secret-over-thirty-two-characters"),
    env: {},
    store: {
      products: async () => {
        reads++;
        return [];
      },
    },
    modelClient: {
      models: {
        generateContent: async () => {
          calls++;
          if (calls === 1)
            return {
              functionCalls: [
                { name: "search_products", args: { query: "cleanser" } },
              ],
            };
          if (calls === 2)
            throw Object.assign(new Error("transient"), { status: 504 });
          return { text: "No matching products found." };
        },
      },
    },
  });
  assert.equal(calls, 3);
  assert.equal(reads, 1);
  assert.ok(result.historyToken);
});
