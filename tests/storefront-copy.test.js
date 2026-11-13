import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { catalogue } from "../server/catalogue.js";

const window = {};
runInNewContext(readFileSync("js/storefront-copy.js", "utf8"), { window });
const copy = window.GlowLabCopy;

test("presentation removes only the known legacy description without changing product records", () => {
  const before = JSON.stringify(catalogue);
  for (const product of catalogue) {
    const description = copy.productDescription(product);
    assert.ok(description.includes(product.brand));
    assert.doesNotMatch(description, /demo|existing|project/i);
    assert.equal(
      copy.productDescription({
        ...product,
        description: "New configured description.",
      }),
      "New configured description.",
    );
  }
  assert.equal(JSON.stringify(catalogue), before);
});

test("legacy policies retain privacy and simulation facts without illustrative promises; configured policies pass through", () => {
  const policies = JSON.parse(readFileSync("data/policies.json", "utf8"));
  for (const policy of policies) {
    const presented = copy.policy(policy);
    assert.equal(presented.slug, policy.slug);
    assert.doesNotMatch(
      presented.content,
      /1–3|3–7|7 days|48 hours|payment_status|order_status|configured database/,
    );
    const configured = { ...policy, content: "Updated configured policy." };
    assert.equal(copy.policy(configured), configured);
  }
  assert.match(
    copy.policy(policies.find((p) => p.slug === "privacy")).content,
    /saved/,
  );
  assert.match(
    copy.policy(policies.find((p) => p.slug === "privacy")).content,
    /Google Gemini/,
  );
  assert.match(
    copy.policy(policies.find((p) => p.slug === "payment")).content,
    /no money is charged/,
  );
});

test("payment presentation never describes simulated paid as a real payment or pending as complete", () => {
  assert.equal(
    copy.payment({ payment_method: "simulated", payment_status: "paid" }),
    "Simulation complete · no money charged",
  );
  assert.equal(
    copy.payment({ payment_method: "simulated", payment_status: "pending" }),
    "Pending · simulated payment",
  );
  assert.equal(
    copy.payment({ payment_method: "other", payment_status: "pending" }),
    "Pending",
  );
  assert.equal(copy.status(undefined), "Not available");
  assert.equal(copy.status("unfulfilled"), "Not dispatched");
});

test("all customer pages retain disclosures, complete product detail slots and copy helper before main script", () => {
  for (const name of readdirSync(".").filter((n) => n.endsWith(".html"))) {
    const html = readFileSync(name, "utf8");
    assert.ok(
      html.indexOf('src="js/storefront-copy.js"') <
        html.indexOf('src="js/script.js"'),
      name,
    );
    assert.match(html, /Demonstration store · no payments or dispatches/, name);
    assert.doesNotMatch(
      html,
      /Fictional skincare store|Demo store|Portfolio project|existing demo collection|never sleeps|• Online/i,
      name,
    );
    for (const id of [
      "modalSize",
      "modalCategory",
      "modalIngredients",
      "modalHowTo",
    ])
      assert.ok(html.includes(`id="${id}"`), name + " " + id);
  }
  const checkout = readFileSync("checkout.html", "utf8").replace(/\s+/g, " ");
  assert.match(checkout, /no money is charged and no products are dispatched/);
  assert.match(checkout, /input required="" type="checkbox"/);
  assert.match(checkout, /Use fictional contact and delivery details/);
});
