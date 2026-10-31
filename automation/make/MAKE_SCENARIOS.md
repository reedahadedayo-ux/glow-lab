# GlowLab Skincare — Make Scenarios Architecture & Configuration

This directory contains importable Make.com blueprints for orchestrating GlowLab's Abandoned Cart Recovery workflow between **Supabase**, **Klaviyo**, and **Airtable**.

---

## Security & Credential Boundaries

- **Make Webhook URLs** (`MAKE_CHECKOUT_STARTED_WEBHOOK_URL` and `MAKE_PLACED_ORDER_WEBHOOK_URL`) are stored exclusively as **server-side environment variables** in Supabase Edge Functions / Vercel Serverless Functions. They are never exposed in frontend JavaScript.
- **Klaviyo Private API Key** (`KLAVIYO_PRIVATE_API_KEY`) and **Supabase Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`) are stored inside Make's encrypted Connection / Team Variables.

---

## Scenario 1: `Checkout Started` Processor
**Blueprint file:** `scenario-1-checkout-started.blueprint.json`

### Workflow Steps:
1. **Custom Webhook (`gateway:CustomWebHook`)**:
   - Receives the validated `Checkout Started` JSON payload from `/api/checkout` (or `supabase/functions/checkout-start`).
2. **Router + Validation Filter (`builtin:BasicRouter`)**:
   - Verifies that `event_id`, `checkout_id`, `customer_email` (contains `@`), and `cart_subtotal > 0` exist.
3. **Klaviyo Profile Upsert (`POST https://a.klaviyo.com/api/profile-import/`)**:
   - Creates or updates the customer profile in Klaviyo with `email`, `first_name`, `phone_number`, and custom profile property `marketing_consent` (`true` / `false`).
4. **Klaviyo Event Creation (`POST https://a.klaviyo.com/api/events/`)**:
   - Sends the `Checkout Started` metric with `unique_id: "{{1.event_id}}"` (preventing duplicate events in Klaviyo), `value: {{1.cart_subtotal}}`, `value_currency: "NGN"`, `items`, `product_names`, `product_ids`, `product_quantities`, `product_prices`, and `checkout_recovery_url`.
5. **Airtable Record Creation (`airtable:ActionCreateRecord`)**:
   - Inserts a new row into the `Checkout & Recovery Tracker` table with initial reminder statuses (`Scheduled` if `marketing_consent = true`, or `Skipped (No Consent)` if `false`).
6. **Supabase Callback (`POST /functions/v1/automation-callback`)**:
   - Marks `automation_events.status = 'processed'` and records `processed_at`.
7. **Error Handler Route**:
   - If Klaviyo or Airtable returns a `4xx`/`5xx` or network timeout, Make routes to the fallback handler which updates `automation_events.status = 'failed'` and logs `error_message` so the event can be safely retried without duplicating the checkout record.

---

## Scenario 2: `Placed Order` (Simulated Purchase) Processor
**Blueprint file:** `scenario-2-placed-order.blueprint.json`

### Workflow Steps:
1. **Custom Webhook (`gateway:CustomWebHook`)**:
   - Receives the `Placed Order` JSON payload when a customer completes a simulated purchase via `/api/purchase` (or `supabase/functions/purchase-simulate`).
2. **Router + Validation Filter**:
   - Verifies `event_id`, `order_id`, `checkout_id`, and `customer_email`.
3. **Klaviyo Event Creation (`POST https://a.klaviyo.com/api/events/`)**:
   - Sends the `Placed Order` metric linked to the customer's `email`, `checkout_id`, and `order_number` (`GL-SIM-...`), with `unique_id: "{{1.event_id}}"`.
   - **Automatic Suppression Effect**: Because the Klaviyo Abandoned Cart Flow has the flow filter *"Has Placed Order zero times since starting this flow"*, receiving this event immediately suppresses Email 1 and/or Email 2 for that customer.
4. **Airtable Record Update (`airtable:ActionUpdateRecord`)**:
   - Updates the matching `Checkout ID` row in Airtable: sets `Purchase Status = Simulated Purchase`, updates `First/Second Reminder Status = Suppressed (Purchased)`, and records `Recovery Outcome`.
5. **Supabase Callback (`POST /functions/v1/automation-callback`)**:
   - Confirms `automation_events.status = 'processed'`.
6. **Error Handler Route**:
   - Records any failure in `automation_events` with `status = 'failed'` for safe retry.
