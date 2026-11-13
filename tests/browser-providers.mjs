// Actual frontend/HTTP/storage; provider transports are deliberately mocked.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import binary from "@sparticuz/chromium";
import { inflate } from "../node_modules/@sparticuz/chromium/build/lambdafs.js";
import { createApp } from "../server/app.js";
import { LocalStore } from "../server/local-store.js";
import { createGroqClient } from "../server/groq.js";
await inflate("node_modules/@sparticuz/chromium/bin/al2023.tar.br");
process.env.LD_LIBRARY_PATH =
  "/tmp/al2023/lib" +
  (process.env.LD_LIBRARY_PATH ? ":" + process.env.LD_LIBRARY_PATH : "");
const browser = await chromium.launch({
  executablePath: await binary.executablePath(),
  args: binary.args,
  headless: true,
});
let checks = 0;
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
try {
  for (const scenario of ["primary", "fallback", "unavailable"]) {
    const store = new LocalStore(":memory:");
    const events = [];
    const primary = createGroqClient(
      { GROQ_API_KEY: "browser-test-only-not-a-real-key" },
      async () =>
        scenario === "primary"
          ? Response.json({
              choices: [
                {
                  message: { content: "Primary transport reply received." },
                  finish_reason: "stop",
                },
              ],
            })
          : new Response("private upstream error", { status: 429 }),
    );
    const modelClient = {
      models: {
        async generateContent() {
          if (scenario === "unavailable")
            throw Object.assign(new Error("private fallback error"), {
              status: 503,
            });
          return { text: "Fallback transport reply received." };
        },
      },
    };
    const app = createApp({
      store,
      env: {
        DATA_BACKEND: "local",
        GROQ_API_KEY: "test-only-config-marker-not-a-key",
      },
      secret: "browser-provider-test-only-secret-not-for-runtime",
      groqClient: primary,
      modelClient,
      observeProvider: (e) => events.push(e),
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.locator(".lumi-launcher").click();
      assert.doesNotMatch(
        await page.locator(".lumi-header p").innerText(),
        /currently unavailable/,
      );
      await page.locator("#lumiInput").fill("Hello Lumi");
      const responsePromise = page.waitForResponse((r) =>
        r.url().endsWith("/api/lumi"),
      );
      await page.locator("#lumiInput").press("Enter");
      const response = await responsePromise;
      assert.equal(response.status(), scenario === "unavailable" ? 503 : 200);
      const expected =
        scenario === "primary"
          ? "Primary transport reply received."
          : scenario === "fallback"
            ? "Fallback transport reply received."
            : "temporarily unavailable";
      await page.waitForFunction(
        (value) =>
          [...document.querySelectorAll(".lumi-message")].some((e) =>
            e.textContent.includes(value),
          ),
        expected,
      );
      assert.doesNotMatch(
        await page.locator("#lumiHistory").innerText(),
        /private upstream|private fallback|not-a-real-key/,
      );
      assert.equal(await page.locator("#lumiInput").isEnabled(), true);
      assert.deepEqual(pageErrors, []);
      assert.equal(events[0].provider, "groq");
      if (scenario !== "primary")
        assert.equal(events.at(-1).provider, "gemini");
      // Retains keyboard-operable close control and fits the touch viewport.
      await page.locator("#closeLumi").focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      checks++;
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      store.db.close();
    }
  }
  console.log(
    `PASS: ${checks} provider frontend scenarios at 390px; primary/fallback/error text delivered, controls usable, no page errors. Provider transports mocked.`,
  );
} finally {
  await browser.close();
}
