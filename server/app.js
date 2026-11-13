import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { signer as makeSigner } from "./security.js";
import { AppError, parse, checkoutSchema, ticketSchema } from "./validation.js";
import { publicProduct } from "./catalogue.js";
import { respond } from "./lumi.js";
import { executeTool } from "./tools.js";
export function createApp({
  store,
  env = process.env,
  secret,
  modelClient,
} = {}) {
  const app = express();
  const signer = makeSigner(secret);
  if (env.VERCEL) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors:
            env.NODE_ENV === "production"
              ? ["'self'"]
              : [
                  "'self'",
                  "https://*.e2b.app",
                  "https://arena.ai",
                  "https://*.arena.ai",
                ],
          upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      frameguard:
        env.NODE_ENV === "production" ? { action: "sameorigin" } : false,
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.locals.requestId = randomUUID();
    res.set("X-Request-ID", res.locals.requestId);
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 120,
      message: { error: "Too many requests. Wait a minute and try again." },
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, res, next) => {
    if (req.method === "POST") {
      const origin = req.get("origin");
      let allowed = true;
      if (origin) {
        try {
          const parsed = new URL(origin);
          allowed = env.APP_ORIGIN
            ? origin === env.APP_ORIGIN
            : ["http:", "https:"].includes(parsed.protocol) &&
              parsed.host === req.get("host");
        } catch {
          allowed = false;
        }
      } else if (req.get("sec-fetch-site") === "cross-site") allowed = false;
      if (!allowed)
        return res
          .status(403)
          .json({ error: "Request origin is not allowed." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "JSON content required." });
    }
    const raw = req.headers.cookie?.match(
      /(?:^|; )glowlab_session=([a-f0-9]{64})(?:;|$)/,
    )?.[1];
    const cookie = raw || signer.cookie();
    if (!raw)
      res.cookie("glowlab_session", cookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: !!env.VERCEL || env.NODE_ENV === "production",
        maxAge: 30 * 86400000,
        path: "/",
      });
    req.owner = signer.owner(cookie);
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  const requireStore = () => {
    if (!store)
      throw new AppError(
        503,
        "The store database is not configured. Please try again later. No successful order or ticket has been confirmed.",
        "DATABASE_NOT_CONFIGURED",
      );
    return store;
  };
  app.get("/api/config", (_req, res) =>
    res.json({
      storage: store
        ? env.DATA_BACKEND === "local"
          ? "local-demo"
          : "supabase"
        : "unconfigured",
      gemini: !!env.GEMINI_API_KEY,
      simulated: true,
    }),
  );
  app.get("/api/products", async (_req, res) =>
    res.json({
      products: (await requireStore().products()).map(publicProduct),
      source: "database",
      backend: env.DATA_BACKEND === "local" ? "local-demo" : "supabase",
    }),
  );
  app.get("/api/ready", async (_req, res) => {
    const records = await requireStore().products();
    if (!records.length)
      throw new AppError(
        503,
        "The collection is not available yet. Please try again later.",
        "CATALOGUE_EMPTY",
      );
    res.json({
      ready: true,
      database: env.DATA_BACKEND === "local" ? "local-demo" : "supabase",
      catalogueCount: records.length,
      geminiConfigured: !!env.GEMINI_API_KEY,
    });
  });
  app.get("/api/products/:id", async (req, res) => {
    const id = parse(z.string().min(1).max(100), req.params.id);
    const product = (await requireStore().products()).find((p) => p.id === id);
    if (!product)
      throw new AppError(
        404,
        "This product is not in the collection.",
        "PRODUCT_NOT_FOUND",
      );
    res.json({
      product: publicProduct(product),
      source: "database",
      backend: env.DATA_BACKEND === "local" ? "local-demo" : "supabase",
    });
  });
  app.get("/api/policies", async (_req, res) =>
    res.json({ policies: await requireStore().policies() }),
  );
  app.post(
    "/api/checkout",
    rateLimit({
      windowMs: 60000,
      limit: 15,
      message: { error: "Too many requests. Wait a minute and try again." },
    }),
    async (req, res) => {
      const input = parse(checkoutSchema, req.body);
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ ...input, idempotencyKey: undefined }))
        .digest("hex");
      const order = await requireStore().checkout(
        req.owner,
        input,
        fingerprint,
      );
      res.status(201).json({ order });
    },
  );
  app.post(
    "/api/orders/lookup",
    rateLimit({
      windowMs: 60000,
      limit: 10,
      message: { error: "Too many requests. Wait a minute and try again." },
    }),
    async (req, res) => {
      const input = parse(
        z.object({
          reference: z.string().trim().min(1).max(80),
          email: z.email().max(254),
        }),
        req.body,
      );
      const order = await requireStore().order(
        req.owner,
        input.reference,
        input.email,
      );
      if (!order)
        throw new AppError(
          404,
          "Order not found or could not be verified. Use the browser that placed it and the checkout email.",
        );
      res.json({ order });
    },
  );
  app.post(
    "/api/support",
    rateLimit({
      windowMs: 60000,
      limit: 5,
      message: { error: "Too many requests. Wait a minute and try again." },
    }),
    async (req, res) => {
      const { idempotencyKey, ...draft } = req.body || {};
      parse(z.uuid(), idempotencyKey);
      const input = parse(ticketSchema, draft);
      const ticket = await requireStore().ticket(
        req.owner,
        input,
        idempotencyKey,
      );
      res.status(201).json({ ticket });
    },
  );
  app.post(
    "/api/support/confirm",
    rateLimit({
      windowMs: 60000,
      limit: 5,
      message: { error: "Too many requests. Wait a minute and try again." },
    }),
    async (req, res) => {
      const data = signer.open(req.body?.token);
      if (data.kind !== "support" || data.owner !== req.owner)
        throw new AppError(403, "Ticket belongs to a different session.");
      let history;
      if (req.body.historyToken) {
        history = signer.open(req.body.historyToken);
        if (history.kind !== "history" || history.owner !== req.owner)
          throw new AppError(403, "Conversation belongs to another session.");
      }
      const { ticket } = await executeTool(
        "create_support_ticket",
        data.draft,
        {
          store: requireStore(),
          owner: req.owner,
          signer,
          approval: { key: data.key },
        },
      );
      let historyToken;
      if (history) {
        history.contents.push({
          role: "user",
          parts: [
            {
              text: `Store-verified customer approval: support ticket ${ticket.id} has now been persisted with status ${ticket.status}. No email was sent.`,
            },
          ],
        });
        history.expires = Date.now() + 2 * 60 * 60 * 1000;
        historyToken = signer.seal(history);
      }
      res.status(201).json({ ticket, historyToken });
    },
  );
  app.post(
    "/api/lumi",
    rateLimit({
      windowMs: 60000,
      limit: 12,
      message: { error: "Too many requests. Wait a minute and try again." },
    }),
    async (req, res) => {
      const input = parse(
        z.object({
          message: z.string().trim().min(1).max(2000),
          historyToken: z.string().max(100000).optional(),
        }),
        req.body,
      );
      res.json(
        await respond({
          ...input,
          store: requireStore(),
          owner: req.owner,
          signer,
          env,
          modelClient,
        }),
      );
    },
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  // Explicit asset/page allowlist: never publish repository files, credentials or databases.
  const root = fileURLToPath(new URL("../", import.meta.url));
  for (const directory of ["css", "js", "images"])
    app.use(
      "/" + directory,
      express.static(root + directory, { dotfiles: "deny", maxAge: "1h" }),
    );
  const pages = [
    "index",
    "products",
    "about",
    "faq",
    "contact",
    "cart",
    "checkout",
    "confirmation",
    "policies",
  ];
  for (const page of pages)
    app.get(
      page === "index"
        ? ["/", "/index", "/index.html"]
        : [`/${page}`, `/${page}.html`],
      (_req, res) => res.sendFile(root + page + ".html"),
    );
  app.get(/^\/glowlab-skincare(?:\/.*)?$/, (req, res) => {
    const page = req.path.split("/").pop()?.replace(".html", "") || "index";
    res.redirect(301, pages.includes(page) ? `/${page}.html` : "/");
  });
  app.use((_req, res) =>
    res
      .status(404)
      .type("html")
      .send('<h1>Page not found</h1><p><a href="/">Return to GlowLab</a></p>'),
  );
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    const requestId = res.locals.requestId;
    if (error.diagnostic)
      console.error(JSON.stringify({ ...error.diagnostic, requestId }));
    res.status(status).json({
      code: error instanceof AppError ? error.code : "SERVER_ERROR",
      requestId,
      error:
        status < 500 || error instanceof AppError
          ? error.message
          : "Something went wrong. Please try again. No success has been confirmed.",
    });
  });
  return app;
}
