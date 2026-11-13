import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import binary from "@sparticuz/chromium";
import { inflate } from "../node_modules/@sparticuz/chromium/build/lambdafs.js";
import { createApp } from "../server/app.js";
import { LocalStore } from "../server/local-store.js";
import { AppError } from "../server/validation.js";
// Test transport ONLY: application runtime never substitutes a scripted AI for Gemini.
const modelClient = {
  models: {
    async generateContent({ contents }) {
      const last = contents.at(-1);
      if (last.parts[0].functionResponse) {
        const r = last.parts[0].functionResponse.response;
        return {
          text:
            r.error ||
            (r.confirmation_required
              ? "Please review and submit the ticket below."
              : r.reference
                ? `Order ${r.reference}: ${r.order_status}; ${r.payment_method} payment.`
                : r.routine
                  ? "Here is a basic morning and evening routine. Review your selection before adding it."
                  : "Here are the catalogue results."),
        };
      }
      const message = last.parts[0].text;
      let name = "build_skincare_routine",
        args = { skinType: "Oily", budget: 50000 };
      if (message.startsWith("lookup ")) {
        name = "lookup_order";
        args = { reference: message.split(" ")[1], email: "demo@example.com" };
      } else if (message === "report damaged order") {
        name = "create_support_ticket";
        args = {
          name: "Demo Customer",
          email: "demo@example.com",
          issue: "My demo order arrived damaged. Please record the issue.",
          priority: "normal",
        };
      }
      return { functionCalls: [{ name, args, id: "test-call" }] };
    },
  },
};
const store = new LocalStore(":memory:");
const app = createApp({
  store,
  secret: "browser-tests-only-secret-32-characters-minimum",
  env: { DATA_BACKEND: "local" },
  modelClient,
});
const server = app.listen(0, "0.0.0.0");
await new Promise((r) => server.once("listening", r));
let base = `http://127.0.0.1:${server.address().port}`;
await inflate("node_modules/@sparticuz/chromium/bin/al2023.tar.br");
process.env.LD_LIBRARY_PATH =
  "/tmp/al2023/lib" +
  (process.env.LD_LIBRARY_PATH ? ":" + process.env.LD_LIBRARY_PATH : "");
const browser = await chromium.launch({
  executablePath: await binary.executablePath(),
  args: binary.args,
  headless: true,
});
mkdirSync("test-results", { recursive: true });
let checks = 0;
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
let resilienceServer;
try {
  for (const name of [
    "index",
    "products",
    "about",
    "faq",
    "contact",
    "cart",
    "checkout",
    "confirmation",
    "policies",
  ]) {
    const r = await page.goto(base + "/" + name + ".html");
    assert.equal(r.status(), 200);
    await page.waitForFunction(() => window.openLumi);
    assert.equal(await page.locator('nav a[href*="checkout"]').count(), 0);
    assert.equal(
      await page
        .locator("nav")
        .getByText("Automation", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator('script[src*="botpress"],script[src*="bpcontent"]')
        .count(),
      0,
    );
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images]
          .filter((i) => i.getAttribute("src"))
          .map(async (i) => {
            i.loading = "eager";
            try {
              await i.decode();
            } catch {}
          }),
      );
    });
    assert.equal(
      await page.evaluate(() =>
        [...document.images]
          .filter((i) => i.getAttribute("src"))
          .every((i) => i.complete && i.naturalWidth > 0),
      ),
      true,
      name + " images",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      name + " desktop overflow",
    );
    checks++;
  }
  await page.goto(base + "/products.html");
  await page.waitForFunction(
    () => document.querySelectorAll(".product-card").length === 12,
  );
  await page.locator("#productSearch").fill("CeraVe");
  assert.equal(await page.locator(".product-card").count(), 2);
  await page.locator("#productSearch").fill("");
  await page.getByRole("button", { name: "Sunscreens", exact: true }).click();
  assert.equal(await page.locator(".product-card").count(), 3);
  await page.getByRole("button", { name: "All Products", exact: true }).click();
  await page.locator('[data-view="cerave-foaming"]').last().click();
  await page
    .getByRole("button", { name: "Add to cart", exact: true })
    .last()
    .click();
  assert.equal(
    await page.locator("[data-cart-count]").first().textContent(),
    "1",
  );
  await page.keyboard.press("Escape");
  checks++;
  await page.goto(base + "/cart.html");
  await page.waitForSelector(".cart-item");
  await page.locator('[data-delta="1"]').click();
  assert.match(
    await page.locator(".summary-row.total").textContent(),
    /29,000/,
  );
  await page.reload();
  await page.waitForSelector(".cart-item");
  assert.match(await page.locator(".quantity").textContent(), /2/);
  await page.locator('[data-delta="-1"]').click();
  await page.locator("[data-remove]").click();
  assert.equal(await page.locator(".cart-item").count(), 0);
  checks++;
  await page.goto(base + "/products.html");
  await page.waitForFunction(() => window.openLumi);
  await page.locator(".lumi-launcher").click();
  await page
    .locator("#lumiInput")
    .fill("Build a routine for oily skin with a budget of 50000");
  await page.locator("#lumiInput").press("Enter");
  await page.waitForSelector(".lumi-products");
  assert.equal(await page.locator(".lumi-product").count(), 3);
  assert.equal(
    await page.locator("[data-cart-count]").first().textContent(),
    "0",
  );
  for (const checkbox of await page.locator(".lumi-product input").all())
    await checkbox.check();
  await page.getByRole("button", { name: "Add selected to cart" }).click();
  assert.equal(
    await page.locator("[data-cart-count]").first().textContent(),
    "3",
  );
  await page.locator("#closeLumi").click();
  checks++;
  await page.goto(base + "/cart.html");
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.waitForSelector("#checkoutForm");
  // Browser native validation: an empty form must not create any order.
  await page.getByRole("button", { name: "Place demo order" }).click();
  assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 0);
  for (const [name, value] of Object.entries({
    name: "Demo Customer",
    email: "demo@example.com",
    phone: "+234 800 000 0000",
    address: "12 Demo Street",
    city: "Jos",
  }))
    await page.locator(`[name="${name}"]`).fill(value);
  await page.locator("#checkoutForm [type=checkbox]").check();
  await page.getByRole("button", { name: "Place demo order" }).click();
  await page.waitForURL("**/confirmation.html");
  await page.waitForSelector(".order-reference");
  const reference = await page.locator(".order-reference").textContent();
  assert.match(reference, /GL-/);
  assert.match(
    await page.locator("#confirmationContent").textContent(),
    /paid · simulated/,
  );
  assert.match(
    await page.locator("#confirmationContent").textContent(),
    /unfulfilled/,
  );
  assert.match(
    await page.locator("#confirmationContent").textContent(),
    /Subtotal/,
  );
  assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 1);
  await page.reload();
  await page.waitForSelector(".order-reference");
  checks++;
  await page.getByRole("button", { name: "Ask Lumi about this order" }).click();
  await page.locator("#lumiInput").fill("lookup " + reference);
  await page.locator("#lumiInput").press("Enter");
  await page.waitForFunction(
    (ref) =>
      [...document.querySelectorAll(".lumi-message")].some((e) =>
        e.textContent.includes(`Order ${ref}: confirmed`),
      ),
    reference,
  );
  checks++;
  await page.locator("#lumiInput").fill("report damaged order");
  await page.locator("#lumiInput").press("Enter");
  await page.waitForSelector(".support-draft");
  assert.equal(store.db.prepare("SELECT count(*) n FROM tickets").get().n, 0);
  await page
    .getByRole("button", { name: "Submit ticket", exact: true })
    .click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".lumi-message")].some((e) =>
      /Support ticket SUP-.*saved/.test(e.textContent),
    ),
  );
  assert.equal(store.db.prepare("SELECT count(*) n FROM tickets").get().n, 1);
  await page.locator("#closeLumi").click();
  checks++;
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of [
      "index",
      "products",
      "about",
      "faq",
      "contact",
      "cart",
      "checkout",
      "confirmation",
      "policies",
    ]) {
      await page.goto(base + "/" + name + ".html");
      await page.waitForFunction(() => window.openLumi);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        name + " width " + width,
      );
      await page.locator("#mobileToggle").click();
      assert.equal(await page.locator("#mobileMenu").isVisible(), true);
      await page.locator('#mobileMenu a[href="products.html"]').click();
      await page.waitForURL("**/products.html");
      checks++;
    }
  }
  await page.goto(base + "/index.html");
  await page.waitForFunction(() => window.openLumi);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.locator(".lumi-launcher").click();
  await page.screenshot({ path: "test-results/lumi-mobile.png" });
  await page.locator("#closeLumi").click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  // Real Express error responses with injected catalogue outage, not live Supabase.
  resilienceServer = createApp({
    store,
    secret: "browser-tests-only-secret-32-characters-minimum",
    env: { DATA_BACKEND: "local" },
  }).listen(0, "127.0.0.1");
  await new Promise((r) => resilienceServer.once("listening", r));
  base = `http://127.0.0.1:${resilienceServer.address().port}`;
  const originalProducts = store.products.bind(store);
  store.products = async () => {
    throw new AppError(
      503,
      "The store is having trouble connecting. Your cart is safe.",
      "DATABASE_NETWORK",
    );
  };
  await page.goto(base + "/cart.html");
  await page.waitForSelector("[data-retry-store]");
  assert.equal(await page.locator(".connection-state").isVisible(), true);
  const savedCart = await page.evaluate(() =>
    localStorage.getItem("glowlab.cart.v1"),
  );
  await page.reload();
  await page.waitForSelector("[data-retry-store]");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("glowlab.cart.v1")),
    savedCart,
  );
  checks++;
  await page.goto(base + "/checkout.html");
  await page.waitForFunction(() =>
    document
      .querySelector("#checkoutError")
      .textContent.includes("trouble connecting"),
  );
  assert.equal(await page.locator("#placeOrder").isDisabled(), true);
  checks++;
  await page.goto(base + "/contact.html");
  await page.waitForFunction(() => window.openLumi);
  assert.equal(
    await page.locator('#contactForm button[type="submit"]').isEnabled(),
    true,
  );
  checks++;
  await page.goto(base + "/policies.html");
  await page.waitForFunction(() => window.openLumi);
  assert.ok((await page.locator("#policyContent .policy").count()) > 0);
  checks++;
  store.products = originalProducts;
  await page.goto(base + "/products.html");
  await page.waitForSelector(".product-card");
  assert.equal(await page.locator(".product-card").count(), 12);
  checks++;
  assert.deepEqual(
    errors.filter((message) => !message.includes("503 (Service Unavailable)")),
    [],
  );
  console.log(
    `PASS: ${checks} browser journey/page/viewport groups. No unexpected console/page errors; deliberate 503 recovery checked. Gemini transport mocked; local SQLite real. Screenshots in test-results/.`,
  );
} finally {
  await browser.close();
  if (resilienceServer) {
    resilienceServer.closeAllConnections();
    await new Promise((r) => resilienceServer.close(r));
  }
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  store.db.close();
}
