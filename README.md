# GlowLab Skincare — E-Commerce Abandoned Cart Recovery Automation Prototype

> **Fictional Nigerian skincare storefront upgraded into an end-to-end e-commerce automation prototype demonstrating an Abandoned Cart Recovery System built with HTML/CSS/Vanilla JS, Supabase, Make, Klaviyo, Airtable, and Botpress AI (Lumi).**

![Stack](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-9AB19F)
![Backend](https://img.shields.io/badge/Backend-Supabase%20PostgreSQL%20%2B%20Edge%20Functions-1E2328)
![Automation](https://img.shields.io/badge/Orchestration-Make%20%2B%20Klaviyo%20%2B%20Airtable-7A9A80)
![AI Advisor](https://img.shields.io/badge/AI%20Assistant-Botpress%20(Lumi)-FDF8F3)

---

## 1. Project Overview

**GlowLab Skincare** is a fictional Lagos-based skincare retailer offering 12 dermatologist-inspired skincare essentials (CeraVe, Cetaphil, La Roche-Posay, Beauty of Joseon, COSRX, The Ordinary, Paula’s Choice, Skin1004, Eucerin, Neutrogena, Garnier) alongside **Lumi**, a 24/7 Botpress AI skincare advisor.

This project extends the static GlowLab storefront into a **functional e-commerce automation prototype** that captures shopping carts, validates checkout sessions server-side, triggers event-driven workflows through **Supabase**, **Make**, and **Klaviyo**, suppresses recovery emails when a simulated purchase occurs, and logs operational outcomes to an **Airtable** reporting view.

> **Fictional & Simulation Disclaimer:** All products, prices (in Nigerian Naira `NGN`), customer profiles, checkouts, and orders are fictional and created strictly for portfolio demonstration. No real payments are processed, and no actual revenue recovery is claimed.

---

## 2. Business Problem

Skincare shoppers frequently add multiple routine items (cleanser, serum, moisturizer, SPF) to their cart and leave during checkout—often because they get distracted, want to double-check ingredient compatibility, or intend to complete payment later.

Without a structured backend and event-driven automation system:
1. **Carts are lost across sessions** or devices when stored only in volatile browser memory.
2. **Checkout abandonment goes untracked**, leaving the business blind to high-intent shoppers who started checkout.
3. **Generic or poorly timed follow-ups** risk annoying customers who have already completed their purchase or who never consented to marketing emails.
4. **Client-side price manipulation** can corrupt order values if cart totals are not verified server-side.

**Solution:** An end-to-end, consent-aware, idempotent **Abandoned Cart Recovery System** that validates cart totals against a trusted server-side catalogue in Supabase, orchestrates `Checkout Started` and `Placed Order` events via Make into Klaviyo, sends up to two calm, helpful, branded recovery emails with one-click cart restoration links, automatically suppresses reminders upon purchase, and tracks every checkout's lifecycle in Airtable.

---

## 3. System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         GLOWLAB FRONTEND (Vercel)                            │
│  • Existing HTML5 / CSS3 / Vanilla JS Storefront + Botpress AI ("Lumi")      │
│  • Persistent Cart Drawer (localStorage + Server/Supabase Sync)              │
│  • Checkout Form (checkout.html) + Demo Purchase Simulation Controls         │
│  • Automation & Airtable Reporting Hub (automation.html)                     │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │ POST /api/checkout                   │ POST /api/purchase
                    │ (Cart & Customer Validation)         │ (Simulated Order)
                    ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            SERVER-SIDE LAYER (Supabase Edge Functions / Vercel API)          │
│  • Validates required fields & recalculates NGN subtotal from trusted prices │
│  • Enforces idempotency keys to block duplicate events                       │
│  • Persists relational records in Supabase PostgreSQL (RLS enabled)          │
│  • Generates secure checkout recovery URL (?recover_checkout=gl_rec_...)     │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │ Webhook: Checkout Started            │ Webhook: Placed Order
                    ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        MAKE WORKFLOW ORCHESTRATION                           │
│  • Scenario 1 (Checkout Started): Validates payload → Upserts Klaviyo        │
│    Profile → Sends "Checkout Started" Event → Logs row to Airtable →         │
│    Updates Supabase automation_events.status = 'processed'                   │
│  • Scenario 2 (Placed Order): Validates order link → Sends "Placed Order"    │
│    Event to Klaviyo → Updates Airtable & Supabase conversion status          │
│  • Error Handler Routes: Captures HTTP 4xx/5xx failures into Supabase for    │
│    safe retry without duplicate checkout creation                            │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │                                      │
                    ▼                                      ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────────┐
│         KLAVIYO RECOVERY FLOW         │  │   AIRTABLE OPERATIONAL TRACKER    │
│  • Trigger: Checkout Started          │  │  • Tracks Customer Email,         │
│  • Filter 1: Placed Order = 0         │  │    Checkout ID, Cart Value (NGN), │
│  • Filter 2: marketing_consent = true │  │    Products, Reminder 1 & 2       │
│  • Wait #1 → Check → Send Email 1     │  │    Statuses, Purchase Status,     │
│  • Wait #2 → Check → Send Email 2     │  │    and Recovery Outcome           │
└───────────────────────────────────────┘  └───────────────────────────────────┘
```

---

## 4. Technology Stack

| Layer | Technology | Role in Prototype |
| :--- | :--- | :--- |
| **Storefront UI** | HTML5, CSS3, Vanilla JavaScript | Preserves original GlowLab design (`#FFFFFF`, `#FDF8F3`, `#9AB19F`, `#1E2328`, `Outfit` + `Plus Jakarta Sans`), 12-product catalog, slide-over cart drawer, and checkout UI. |
| **AI Skincare Advisor** | Botpress Webchat v5.0 (**Lumi**) | Embedded 24/7 AI skincare assistant helping shoppers pick routines by skin type and concern. |
| **Database & Backend** | Supabase PostgreSQL + Edge Functions + Vercel Serverless API | Relational storage (`products`, `customers`, `carts`, `cart_items`, `checkouts`, `orders`, `automation_events`), Row Level Security (RLS), server-side price calculation, and idempotency checks. |
| **Workflow Automation** | Make (Integromat) | Two modular scenarios (`Checkout Started` and `Placed Order`) with routers, validation filters, Klaviyo/Airtable/Supabase HTTP modules, and error handlers. |
| **Email Marketing & Flows** | Klaviyo | Customer profile management, `Checkout Started` and `Placed Order` metrics, conditional split purchase suppression, consent filtering, and 2 branded HTML recovery emails. |
| **Operational Reporting** | Airtable (+ Live Web Dashboard) | Operational visibility into abandoned checkouts, reminder statuses, and simulated conversions. |
| **Hosting** | Vercel | Hosts the static storefront and serverless `/api/*` endpoints. |

---

## 5. Supabase Database Schema

Defined in [`supabase/migrations/001_glowlab_ecommerce_automation.sql`](supabase/migrations/001_glowlab_ecommerce_automation.sql) and seeded in [`supabase/seed.sql`](supabase/seed.sql):

1. **`products`**:
   - `id` (TEXT PK, e.g. `'cerave-foaming'`), `name`, `brand`, `price` (INTEGER NGN), `compare_price`, `currency`, `category`, `image`, `skin_type`, `concern`, `active`, `created_at`, `updated_at`.
   - *Purpose*: Authoritative server-side price table so client-submitted prices are never trusted.
2. **`customers`**:
   - `id` (UUID PK), `email` (TEXT UNIQUE), `full_name`, `phone`, `marketing_consent` (BOOLEAN), `consent_updated_at`, `klaviyo_profile_id`, `created_at`, `updated_at`.
3. **`carts`**:
   - `id` (UUID PK), `customer_id` (FK → `customers.id`), `status` (`active` | `checkout_started` | `abandoned` | `recovered` | `purchased`), `subtotal` (INTEGER NGN), `item_count`, `created_at`, `updated_at`.
4. **`cart_items`**:
   - `id` (UUID PK), `cart_id` (FK → `carts.id` ON DELETE CASCADE), `product_id` (FK → `products.id`), `quantity`, `unit_price`, `line_total`, `UNIQUE(cart_id, product_id)`.
5. **`checkouts`**:
   - `id` (UUID PK), `cart_id` (FK → `carts.id`), `customer_id` (FK → `customers.id`), `customer_name`, `customer_email`, `customer_phone`, `delivery_state`, `delivery_address`, `marketing_consent`, `subtotal`, `currency`, `item_summary` (JSONB), `recovery_token` (UNIQUE), `recovery_url`, `status` (`pending` | `converted` | `abandoned` | `expired`), `first_reminder_status`, `second_reminder_status`, `purchase_status`, `recovery_outcome`, `converted_at`, `created_at`, `updated_at`.
6. **`orders`**:
   - `id` (UUID PK), `order_number` (TEXT UNIQUE, e.g. `GL-SIM-804210`), `checkout_id` (UUID UNIQUE FK → `checkouts.id`), `cart_id` (FK → `carts.id`), `customer_id` (FK → `customers.id`), `customer_email`, `customer_name`, `total_amount`, `currency`, `items` (JSONB), `status` (`simulated` | `completed`), `is_demo_simulation` (BOOLEAN DEFAULT TRUE), `created_at`, `updated_at`.
7. **`automation_events`**:
   - `id` (UUID PK), `event_id` (TEXT UNIQUE), `idempotency_key` (TEXT UNIQUE), `event_type` (`Checkout Started` | `Placed Order` | `Recovery Email 1` | `Recovery Email 2`), `checkout_id`, `order_id`, `cart_id`, `customer_email`, `payload` (JSONB), `klaviyo_payload` (JSONB), `status` (`pending` | `processed` | `failed`), `attempts`, `make_response_code`, `error_message`, `processed_at`, `created_at`, `updated_at`.

**Row Level Security (RLS):** Enabled across all 7 tables. Public `SELECT` is permitted only on active `products`. All writes and sensitive reads are executed server-side via Supabase Edge Functions (`supabase/functions/*`) / Vercel Serverless Functions (`api/*`) using `SUPABASE_SERVICE_ROLE_KEY`.

---

## 6. Make Scenarios

Blueprints and setup documentation are located in [`automation/make/`](automation/make/):

- **Scenario 1 — `Checkout Started` ([`scenario-1-checkout-started.blueprint.json`](automation/make/scenario-1-checkout-started.blueprint.json))**:
  1. Receives `Checkout Started` webhook from backend.
  2. Validates required fields (`event_id`, `checkout_id`, `customer_email`, `cart_subtotal > 0`).
  3. Upserts the customer profile in Klaviyo (`/api/profile-import/`) including `marketing_consent`.
  4. Dispatches the `Checkout Started` metric to Klaviyo (`/api/events/`) with `unique_id = event_id`.
  5. Creates an operational tracking row in Airtable (`Checkout & Recovery Tracker`).
  6. Sends a callback to Supabase marking `automation_events.status = 'processed'` (or `'failed'` with error details on the error handler route).
- **Scenario 2 — `Placed Order` ([`scenario-2-placed-order.blueprint.json`](automation/make/scenario-2-placed-order.blueprint.json))**:
  1. Receives `Placed Order` webhook when a customer triggers a simulated purchase.
  2. Dispatches the `Placed Order` metric to Klaviyo (`/api/events/`) linked to `checkout_id` and `order_number`.
  3. Updates the Airtable record (`Purchase Status = Simulated Purchase`, `Recovery Outcome = Converted / Recovered`) and confirms event completion in Supabase.

---

## 7. Klaviyo Flow Logic & Configurable Delays

Full documentation in [`automation/klaviyo/klaviyo-flow-logic.md`](automation/klaviyo/klaviyo-flow-logic.md):

1. **Trigger**: Metric `Checkout Started`.
2. **Flow Filters**:
   - `Placed Order zero times since starting this flow` (auto-evaluated before every step).
   - `Properties about someone: marketing_consent equals true` (prevents sending marketing recovery emails without consent).
3. **Wait Interval #1**:
   - **Portfolio Testing Delay**: `2–5 minutes` (or instant trigger via the Demo Time-Travel buttons in `checkout.html` / `automation.html`).
   - **Recommended Production Delay**: `1 hour`.
4. **Conditional Split #1**: Checks whether `Placed Order` has occurred since checkout started.
   - If **Yes** → Suppresses Email 1 & Email 2 and exits flow (`converted_before_reminder_1`).
   - If **No** → Sends **Recovery Email 1**.
5. **Wait Interval #2**:
   - **Portfolio Testing Delay**: `5–10 minutes`.
   - **Recommended Production Delay**: `23 hours` (`24 hours` total post-abandonment).
6. **Conditional Split #2**: Checks whether `Placed Order` has occurred after Email 1.
   - If **Yes** → Suppresses Email 2 and exits flow (`recovered_after_reminder_1`).
   - If **No** → Sends **Recovery Email 2** (`abandoned_unpaid`).

---

## 8. Recovery Email Sequence

Located in [`automation/klaviyo/`](automation/klaviyo/) and previewable live at [`/automation.html#email-previews`](automation.html):

- **Email 1 ([`email-1-first-reminder.html`](automation/klaviyo/email-1-first-reminder.html))**:
  - **Subject**: *Still thinking about your GlowLab routine? 🌿*
  - **Content**: Warm, calm reminder displaying each saved product's image, brand, name, quantity, unit price, NGN cart total, and a **Return to My Cart →** button linking to `{{ event.extra.checkout_recovery_url }}`. No fake urgency.
- **Email 2 ([`email-2-second-reminder.html`](automation/klaviyo/email-2-second-reminder.html))**:
  - **Subject**: *Still deciding on your skincare routine? Your cart is saved*
  - **Content**: Friendly second check-in with a clean saved-routine summary, **Restore My Saved Cart →** link, and an invitation to chat with **Lumi** if the shopper has questions about ingredients or skin compatibility. No invented discounts or false scarcity.

---

## 9. Airtable Operational Reporting Dashboard

Schema and sample CSV located in [`automation/airtable/`](automation/airtable/), with a live interactive mirror on [`/automation.html`](automation.html):

- **Tracked Fields**: `Checkout ID`, `Customer Email`, `Customer Name`, `Cart Value (NGN)`, `Products`, `Checkout Date`, `Marketing Consent`, `First Reminder Status`, `Second Reminder Status`, `Purchase Status`, `Recovery Outcome`, and `Recovery URL`.
- Includes one-click **Export Airtable CSV** on `/automation.html` to import live session records directly into Airtable.

---

## 10. Test Scenarios & Verified Outcomes

All 6 required test scenarios can be executed interactively from [`/automation.html#test-scenarios`](automation.html) or via `POST /api/test-scenarios`:

| Test # | Scenario | Input / Action | Verified Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Test 1** | **Abandoned Checkout** | Customer starts checkout with consent; no purchase occurs across both delays. | `Checkout Started` logged; Email 1 status = `sent`; Email 2 status = `sent`; Checkout status = `abandoned`; Outcome = `abandoned_unpaid`. | ✅ **PASSED** |
| **Test 2** | **Purchase Before 1st Reminder** | Customer starts checkout, then simulates purchase before Delay #1 expires. | Simulated order created; `Placed Order` sent; Email 1 & Email 2 both marked `suppressed`; Outcome = `converted_before_reminder_1`. | ✅ **PASSED** |
| **Test 3** | **Purchase After 1st Reminder** | Customer receives Email 1, restores cart, and simulates purchase before Delay #2. | Email 1 = `sent`; Simulated order created; Email 2 marked `suppressed`; Outcome = `recovered_after_reminder_1`. | ✅ **PASSED** |
| **Test 4** | **Duplicate Event Prevention** | Identical `Checkout Started` event submitted twice with the same `idempotency_key`. | Second request returns `duplicate_ignored: true` and original `event_id`; no duplicate checkout or webhook is created. | ✅ **PASSED** |
| **Test 5** | **Invalid Checkout Rejection** | Submits invalid email (`"not-an-email"`) and untrusted product ID (`"non-existent-fake-serum"`). | Server rejects both with `HTTP 400` (`INVALID_EMAIL`, `INVALID_PRODUCT_ID`); zero records or events created. | ✅ **PASSED** |
| **Test 6** | **Workflow Failure & Safe Retry** | Simulates a downstream Make/Klaviyo `HTTP 503` failure during event dispatch, then triggers retry. | Initial failure logged in `automation_events` (`status = 'failed'`, `error_message` populated); safe retry increments `attempts = 2` and transitions status to `processed`. | ✅ **PASSED** |

---

## 11. Completed vs. Simulated Features & Limitations

| Feature | Status | Implementation Details & Limitations |
| :--- | :--- | :--- |
| **Storefront & Lumi Botpress AI** | **Completed** | All original pages (`index.html`, `products.html`, `about.html`, `faq.html`, `contact.html`), 12 products, filters, modals, and Lumi AI widget preserved intact. |
| **Shopping Cart & Persistence** | **Completed** | Add/remove/quantity controls on cards, modal, drawer, and checkout; persists across page refreshes via `localStorage` (`glowlab_cart_id`) and syncs with backend `/api/cart`. |
| **Server-Side Price Validation & Idempotency** | **Completed** | Server recalculates cart subtotals from authoritative product prices and blocks duplicate `idempotency_key` submissions. |
| **Supabase Schema, RLS & Edge Functions** | **Completed** | Full SQL migration (`001_glowlab_ecommerce_automation.sql`), seed data (`seed.sql`), and Deno Edge Functions (`supabase/functions/*`) + Vercel Serverless API (`api/*`). |
| **Make Scenarios & Klaviyo Email Templates** | **Completed** | Importable Make blueprints (`automation/make/*.json`) and two branded HTML emails (`automation/klaviyo/*.html`). |
| **Checkout & Order Payment Collection** | **Simulated** | Uses a clearly labelled **Demo Purchase Simulation** action (`orders.status = 'simulated'`). Does not integrate live Paystack card charging or collect real money. |
| **Botpress Lumi Direct Add-to-Cart** | **Planned (Future)** | Lumi currently provides skincare guidance and product recommendations via Botpress webchat; direct chat-to-cart action buttons remain a future enhancement. |

---

## 12. Loom Demonstration Outline (3–5 Minutes)

1. **0:00 – 0:45 | Business Problem & Storefront Tour (`index.html` & `products.html`)**
   - Introduce GlowLab Skincare and the cart-abandonment challenge in e-commerce.
   - Show the preserved visual identity, Lumi AI assistant, and add 2–3 products (e.g., *CeraVe Foaming Cleanser*, *Beauty of Joseon Relief Sun SPF50+*, *The Ordinary Niacinamide*) to the slide-over cart drawer.
   - Refresh the page to demonstrate persistent cart state (`Cart ID` + `localStorage` + backend sync).
2. **0:45 – 1:45 | Checkout Started & Server-Side Validation (`checkout.html`)**
   - Navigate to `checkout.html`, review the order summary, and explain the explicit Marketing Consent checkbox.
   - Click **Start Demo Checkout (Trigger Checkout Started Event)**.
   - Highlight the generated `Checkout ID`, `Event ID`, `Recovery URL`, and the live `Checkout Started` JSON payload sent to Make & Klaviyo.
   - Click **Resend Duplicate Checkout (Test Idempotency)** to show duplicate prevention in action.
3. **1:45 – 2:45 | Klaviyo Abandoned Cart Flow, Emails & Cart Recovery (`automation.html`)**
   - Open `automation.html#email-previews` to showcase **Email 1** and **Email 2** templates.
   - Click **Test "Return to Cart" Link Live →** (`?recover_checkout=...`) to show how a customer clicking the email restores their exact saved cart.
4. **2:45 – 3:45 | Demo Purchase Simulation & Purchase Suppression (`checkout.html` & `automation.html`)**
   - Click **Simulate Demo Purchase (Trigger Placed Order)**.
   - Show the `Placed Order` payload (`GL-SIM-...`) and how Klaviyo suppresses pending reminder emails.
5. **3:45 – 4:30 | Airtable Operational Tracker & 6-Scenario Test Suite (`automation.html`)**
   - Show the **Checkout & Cart Recovery Operational Tracker** table and click **Run All 6 Test Scenarios** to verify abandoned flow, early conversion suppression, mid-flow recovery, duplicate prevention, invalid input rejection, and failure retry (`6 / 6 PASSED`).
