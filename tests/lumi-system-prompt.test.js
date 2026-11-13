import test from "node:test";
import assert from "node:assert/strict";
import { systemInstruction } from "../server/lumi-system-prompt.js";
import {
  respond,
  systemInstruction as existingExport,
} from "../server/lumi.js";
import { signer } from "../server/security.js";
import { LocalStore } from "../server/local-store.js";

const secret = "prompt-tests-only-session-secret-over-32-characters";

// These are policy/wiring tests, not evidence of a real model's medical or factual accuracy.
test("dedicated Lumi policy covers identity, accuracy, safety, privacy and honest actions", () => {
  assert.equal(existingExport, systemInstruction);
  for (const rule of [
    "friendly, knowledgeable AI skincare shopping assistant",
    "Only recommend products returned by the actual catalogue tools",
    "Respect details_verified",
    "do not fill gaps from memory",
    "one or two relevant questions at a time",
    "skin type, concerns, sensitivities, current routine, preferences and budget",
    "Explain why a suggested product may fit",
    "product-specific usage guidance only when verified",
    "Never diagnose medical conditions",
    "severe irritation, swelling, painful or persistent symptoms",
    "urgent local medical help",
    "Avoid excessive emojis, pressure",
    "Email alone does not establish identity",
    "Never pretend you accessed an order",
    "Do not expose credentials",
    "Never add products to a cart without explicit customer approval",
    "a review draft, not a persisted ticket",
    "No real charges or physical deliveries occur",
  ])
    assert.ok(systemInstruction.includes(rule), rule);
});

for (const message of [
  "What is the difference between a cleanser and a moisturizer?",
  "My face is severely swollen and irritated. Can a serum cure it?",
]) {
  test(`system prompt reaches SDK for input: ${message} (mock transport; not behavior verification)`, async () => {
    let requests = 0;
    const result = await respond({
      message,
      owner: "owner",
      signer: signer(secret),
      env: { GEMINI_MODEL: "gemini-3.5-flash" },
      store: {},
      modelClient: {
        models: {
          async generateContent(input) {
            requests++;
            assert.equal(input.config.systemInstruction, systemInstruction);
            assert.equal(input.contents.at(-1).parts[0].text, message);
            assert.equal(input.model, "gemini-3.5-flash");
            assert.equal(input.config.temperature, 0.2);
            assert.equal(input.config.maxOutputTokens, 1400);
            assert.equal(input.config.tools[0].functionDeclarations.length, 5);
            return { text: "Mock response for prompt-delivery testing only." };
          },
        },
      },
    });
    assert.equal(requests, 1);
    assert.ok(result.text);
    assert.ok(result.historyToken);
  });
}

test("same prompt survives tool-result rounds and signed history; unavailable product stays empty (mock model, real local store)", async () => {
  const store = new LocalStore(":memory:");
  const s = signer(secret);
  const snapshots = [];
  const options = {
    owner: "owner",
    signer: s,
    env: {},
    store,
    modelClient: {
      models: {
        async generateContent(input) {
          snapshots.push(structuredClone(input));
          assert.equal(input.config.systemInstruction, systemInstruction);
          if (snapshots.length === 1)
            return {
              functionCalls: [
                {
                  name: "search_products",
                  id: "prompt-test-search",
                  args: { query: "imaginary-catalogue-product-xyz" },
                },
              ],
            };
          if (snapshots.length === 2) {
            const response = input.contents.at(-1).parts[0].functionResponse;
            assert.equal(response.name, "search_products");
            assert.deepEqual(response.response.products, []);
          }
          return { text: "Mock response; no real model behavior is asserted." };
        },
      },
    },
  };
  try {
    const first = await respond({
      ...options,
      message: "Find imaginary-catalogue-product-xyz",
    });
    assert.deepEqual(first.products, []);
    const history = s.open(first.historyToken).contents;
    await respond({
      ...options,
      message: "What information is unavailable?",
      historyToken: first.historyToken,
    });
    assert.equal(snapshots.length, 3);
    assert.deepEqual(snapshots[2].contents.slice(0, history.length), history);
    assert.equal(
      snapshots[2].contents.at(-1).parts[0].text,
      "What information is unavailable?",
    );
    assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 0);
    assert.equal(store.db.prepare("SELECT count(*) n FROM tickets").get().n, 0);
  } finally {
    store.db.close();
  }
});
