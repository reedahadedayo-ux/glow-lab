import test from "node:test";
import assert from "node:assert/strict";
import { systemInstruction } from "../server/lumi-system-prompt.js";

// Policy-contract checks only: these do not prove a live model follows the prompt.
test("Lumi uses conversational plain text rather than Markdown or system reports", () => {
  for (const rule of [
    "Use natural contractions",
    "Write customer replies in plain text",
    "no asterisks for bold or italics",
    "Prefer short paragraphs over bullet-point reports",
    "Do not pretend to be human",
    "end every answer with a generic offer of help",
    "rather than reciting the internal label",
  ]) {
    assert.ok(systemInstruction.includes(rule), rule);
  }
  const example = systemInstruction
    .split("Example style for verified")[1]
    .split("Use only states")[0];
  assert.doesNotMatch(example, /\*|fulfilment is recorded|the system says/i);
  assert.match(example, /No money was charged/);
  assert.match(example, /doesn't send physical products/);
});

test("Lumi service messages omit provider diagnostics without hiding privacy disclosure", () => {
  for (const rule of [
    "Speak as Lumi",
    "Do not append provider attribution",
    "Never claim a failed lookup or action succeeded",
    "do not change backend provider selection or suppress server-side diagnostics",
    "Do not hide the published privacy disclosure",
  ]) {
    assert.ok(systemInstruction.includes(rule), rule);
  }
});

test("order reply policy separates recorded states from real payment and dispatch", () => {
  for (const rule of [
    "Keep order_status, payment_status and fulfillment_status independent",
    "no money was charged",
    'never "paid for"',
    "Other payment states must be reported as returned",
    "no physical products are dispatched",
    'do not say "not shipped yet"',
    "distinguish that recorded demo state from any real shipment",
  ]) {
    assert.ok(systemInstruction.includes(rule), rule);
  }
});

test("order reply policy avoids invented shipping offers and receipt duplication", () => {
  for (const rule of [
    "under 90 words",
    "do not reproduce its entire contents as a second receipt",
    "only when asked or needed to answer the question",
    "not a free-shipping offer",
    "Consult get_store_policy",
    "Do not invent, recalculate or reinterpret missing fields, dates or time zones",
    "Do not invite customers to request tracking or a shipment date",
    "this example is style guidance, not order data or permission to skip verification",
  ]) {
    assert.ok(systemInstruction.includes(rule), rule);
  }
});

test("concise order replies retain verification, privacy and action boundaries", () => {
  for (const rule of [
    "complete order reference and checkout email, verified together on the server",
    "If verification fails, give the generic failure",
    "Never add products to a cart without explicit customer approval",
    "Never claim an action is complete unless",
    "Never claim an email was sent",
  ]) {
    assert.ok(systemInstruction.includes(rule), rule);
  }
});
