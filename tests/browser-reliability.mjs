// Real browser + Express + SQLite. No production data or external provider calls.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import binary from "@sparticuz/chromium";
import { inflate } from "../node_modules/@sparticuz/chromium/build/lambdafs.js";
import { createApp } from "../server/app.js";
import { LocalStore } from "../server/local-store.js";
import { mkdirSync } from "node:fs";
const store = new LocalStore(":memory:");
const order = await store.checkout(
  "another-browser",
  {
    customer: {
      name: "Reliability Demo",
      email: "demo@example.invalid",
      phone: "+2348000000000",
      address: "12 Fictional Street",
      city: "Jos",
      instructions: "",
    },
    items: [{ productId: "cerave-foaming", quantity: 1 }],
    idempotencyKey: crypto.randomUUID(),
  },
  "test-fingerprint",
);
const app = createApp({
  store,
  secret: "browser-reliability-only-not-a-live-secret",
  env: { DATA_BACKEND: "local" },
});
const server = app.listen(0, "0.0.0.0");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
await inflate("node_modules/@sparticuz/chromium/bin/al2023.tar.br");
process.env.LD_LIBRARY_PATH =
  "/tmp/al2023/lib" +
  (process.env.LD_LIBRARY_PATH ? ":" + process.env.LD_LIBRARY_PATH : "");
const browser = await chromium.launch({
  executablePath: await binary.executablePath(),
  args: binary.args,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const page = await context.newPage();
let checks = 0;
mkdirSync("test-results", { recursive: true });
try {
  // The order was seeded outside this context; clearing cookies between widths
  // verifies independence from a prior lookup session without Chromium single-process context churn.
  for (const width of [1440, 390]) {
    await context.clearCookies();
    await page.setViewportSize({ width, height: 960 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/contact.html#order-lookup");
    await page.waitForFunction(() => window.openLumi);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.locator("#lookupReference").fill(order.reference.toLowerCase());
    await page.locator("#lookupEmail").fill("DEMO@EXAMPLE.INVALID");
    await page
      .getByRole("button", { name: "Check order status", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector("#orderLookupStatus")
        .textContent.startsWith("Verified order"),
    );
    assert.match(
      await page.locator("#orderLookupStatus").textContent(),
      /Confirmed.*Not dispatched.*no money charged/i,
    );
    assert.doesNotMatch(
      await page.locator("#orderLookupStatus").textContent(),
      /Fictional Street|8000000000/,
    );
    assert.match(
      await page.locator("#lumiPanel .lumi-header p").textContent(),
      /currently unavailable/,
    );
    checks++;
    await page.locator("#lookupEmail").fill("wrong@example.invalid");
    await page
      .getByRole("button", { name: "Check order status", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector("#orderLookupStatus")
        .textContent.includes("couldn't verify"),
    );
    const failure = await page.locator("#orderLookupStatus").textContent();
    await page.locator("#lookupReference").fill("GL-NONEXISTENT");
    await page.locator("#lookupEmail").fill("demo@example.invalid");
    await page
      .getByRole("button", { name: "Check order status", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector("#orderLookupForm button").disabled,
    );
    assert.equal(
      await page.locator("#orderLookupStatus").textContent(),
      failure,
    );
    checks++;
    // Native validation must not send a lookup for incomplete input.
    let attempts = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/orders/lookup")) attempts++;
    });
    await page.locator("#lookupEmail").fill("");
    await page
      .getByRole("button", { name: "Check order status", exact: true })
      .click();
    assert.equal(attempts, 0);
    assert.equal(
      await page.locator("#lookupEmail").evaluate((el) => el.validity.valid),
      false,
    );
    checks++;
    await page.screenshot({
      path: `test-results/reliability-contact-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/products.html");
  await page.waitForFunction(() => window.openLumi);
  await page.locator(".lumi-launcher").click();
  // An interrupted request must restore input and controls, without duplicate POSTs.
  let posts = 0;
  await page.route("**/api/lumi", async (route) => {
    posts++;
    await route.abort("failed");
  });
  await page.locator("#lumiInput").fill("A cleanser question");
  await page.locator("#lumiInput").press("Enter");
  await page.waitForSelector(".lumi-message.error");
  assert.equal(
    await page.locator("#lumiInput").inputValue(),
    "A cleanser question",
  );
  assert.equal(
    await page.locator(".lumi-input-row button").isDisabled(),
    false,
  );
  assert.equal(posts, 1);
  checks++;
  await page.unroute("**/api/lumi");
  // Clock-driven UI timeout exercises a genuinely pending fetch without a 40s wait.
  await page.clock.install();
  let release, markRequested;
  const requested = new Promise((resolve) => {
    markRequested = resolve;
  });
  await page.route("**/api/lumi", async (route) => {
    posts++;
    await new Promise((resolve) => {
      release = async () => {
        await route
          .fulfill({ json: { text: "Late response" } })
          .catch(() => {});
        resolve();
      };
      markRequested();
    });
  });
  await page.locator("#lumiInput").fill("Slow question");
  await page.locator("#lumiInput").press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelector("#lumiPanel").getAttribute("aria-busy") === "true",
  );
  // Ensure the route is pending before advancing browser time.
  await requested;
  await page.clock.fastForward(8100);
  assert.match(
    await page.locator(".lumi-message.assistant").last().textContent(),
    /taking longer/,
  );
  await page.clock.fastForward(33000);
  await page.waitForFunction(
    () =>
      document.querySelector("#lumiPanel").getAttribute("aria-busy") ===
      "false",
  );
  assert.match(
    await page.locator(".lumi-message.error").last().textContent(),
    /Lumi couldn't complete this reply/,
  );
  assert.equal(await page.locator("#lumiInput").inputValue(), "Slow question");
  assert.equal(
    await page.locator(".lumi-input-row button").isDisabled(),
    false,
  );
  assert.equal(posts, 2);
  await release();
  checks++;
  console.log(
    `PASS: ${checks} reliability browser groups: desktop/mobile fresh-session verification, generic failures, validation, interrupted request and slow/timeout recovery. Local SQLite; no live providers.`,
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  store.db.close();
}
