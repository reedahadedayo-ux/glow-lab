# Architecture, API and database contract

**Current live schema and migration versions:** see LIVE-INTEGRATION.md and the complete
REVIEW_COMPLETE.sql package. The user authorized a new project and the schema is now applied.
HTTP end-to-end integration remains unverified because the sandbox cannot reach Supabase.

## Boundaries

Existing static pages + vanilla `js/script.js`, shared CSS and local images. No frontend
framework rewrite. Express 5 serves only allowlisted pages/assets; Vercel serves the generated
allowlisted `public/` directory and forwards API calls to the same Express application.

```
browser -> same-origin /api -> validation/session checks -> storage adapter -> existing Supabase
                           -> GoogleGenAI -> model function call -> actual storage tool
                                          <- function result <- then Gemini final response
```

`server/runtime.js` selects Supabase or explicit local-only SQLite. Default misconfiguration
never silently writes to ephemeral/in-memory storage. SQLite is a genuine durable development
database, not evidence of Supabase connectivity. SQL migrations are applied to the user-authorized new project. PGlite tests remain local
syntax/constraint/RLS checks; actual connector tests are reported separately in LIVE-INTEGRATION.md.

## Guest identity and privacy

- Unpredictable 256-bit cookie, HttpOnly, SameSite=Lax, 30-day lifetime. Secure in production.
- Server derives an HMAC owner hash using a stable backend `SESSION_SECRET`. Raw cookies and
  owner hashes are never returned in order JSON. A reference or email is not an access token.
- Lookup checks **both originating browser owner hash and checkout email**. Unknown references,
  wrong email and wrong owner have the same error. AI cannot supply or change owner identity.
- No cross-device order recovery by email alone. Contact can record a general issue if the
  customer loses the original session. An authenticated recovery workflow is future work.
- Order/customer/ticket tables have RLS enabled, no anon/authenticated grants or public policies.
  Server service role bypasses RLS intentionally; every customer route applies owner scoping.
- Same-origin POST checks (or fixed APP_ORIGIN), JSON-only requests, body/message limits,
  allowlisted fields, CSP, escaping and per-process request limits. Exact hostname comparison
  supports HTTPS Arena reverse-proxy origins without trusting arbitrary forwarded hosts.
- Rate limits use in-process memory: **not globally durable across serverless instances**.
  Add platform firewall/distributed limits and AI budget quotas before unrestricted public use.
- Cart uses localStorage (IDs and integer quantities only). Draft delivery/receipt pointer,
  conversation transcript and signed history use sessionStorage. No frontend secrets. Session
  storage may contain fictional PII; use fictional inputs and shared-device care. No analytics
  or emails. Conversation messages go to Google; do not enter medical/payment secrets.

## API endpoints

All API responses are `Cache-Control: no-store`. Mutations require JSON; errors use
`{error:string}`. Zod validates body shape and limits. Prices/status in checkout are rejected
if supplied by the frontend. Errors: 400 validation, 403 identity/origin, 404 unknown/unverified
order, 409 stock/idempotency conflict, 429 request/provider limit, 502 malformed AI output,
503 missing integration/database/provider unavailable.

| Method | Route | Input / output |
|---|---|---|
| GET | `/api/config` | Nonsecret readiness flags, storage mode, simulated=true |
| GET | `/api/products` | Public catalogue only; names, real demo prices, image filenames, availability |
| GET | `/api/policies` | Published records `{slug,title,content}` |
| POST | `/api/checkout` | `{customer:{name,email,phone,address,city,instructions?}, items:[{productId,quantity}], idempotencyKey:uuid}` → `{order}` |
| POST | `/api/orders/lookup` | `{reference,email}` + owner cookie → `{order}` |
| POST | `/api/support` | `{name,email,issue,orderReference?,priority?,idempotencyKey:uuid}` → `{ticket}` |
| POST | `/api/support/confirm` | Signed `{token,historyToken?}` + owner cookie → persisted `{ticket,historyToken?}` |
| POST | `/api/lumi` | `{message,historyToken?}` → `{text,products,routine,ticket,historyToken}` |

There are deliberately **no seller/admin endpoints**. Do not expose service-role queries as
public APIs when connecting future apps. No frontend can list orders or list support tickets.

## Checkout transaction

`checkoutSchema` rejects duplicate IDs, quantities outside 1–20, >30 lines, invalid customer
fields, prices or arbitrary payment flags. The backend fingerprints normalized customer/cart
and scopes a UUID retry key to owner. Same key + same payload returns saved order; changed
payload conflicts. Browser preserves the key across clicks/network retries and refresh.

Supabase RPC `create_demo_order` uses an advisory transaction lock on owner/key, locks product
rows in stable ID order, verifies availability/stock, reads authoritative prices, updates
tracked stock, saves order and immutable item snapshots in one transaction. A failure rolls
back stock and order. Unknown quantity stock remains NULL. Local SQLite uses BEGIN IMMEDIATE
with matching calculation/retry behaviour. Demo delivery fee=0, currency=NGN. No provider,
transaction receipt, charge or outbound notification exists.

## Genuine Gemini function calling

`server/lumi.js` uses the official `@google/genai` SDK, `models.generateContent`, actual
function declarations, model `functionCalls`, and real `functionResponse` parts. It sends
responses back to Gemini before returning final text. Max six model iterations/five calls
per iteration, SDK timeout, bounded text/output, provider errors and malformed/empty responses
handled. There is **no runtime scripted fallback**. Tests inject an SDK-shaped mock explicitly.

`server/tools.js` implements:

- `search_products`: actual catalogue search; publicProduct strips unverified details.
- `lookup_order`: cookie-owner-bound reference + email lookup, limited status/item result;
  addresses/phone are never sent to Gemini by this function.
- `get_store_policy`: only published backend records; unknown topics explicitly unavailable.
- `create_support_ticket`: two-phase action. The model first prepares validated details;
  backend returns an expiring owner-bound signed review token, **not success**. UI approval
  calls the same tool with server-verified approval context; only then does it persist via
  `create_customer_ticket` and return the saved ID. Signed history is updated with the verified
  result. Model arguments cannot set the approval context.
- `build_skincare_routine`: retrieves actual available records, selects simple cleansing,
  moisturizing and morning sunscreen steps within a total budget where possible, reuses
  products in AM/PM and returns IDs/prices/reasons. Selection is deliberately conservative,
  not a diagnosis; no unverified active ingredients. It reports partial routines and cannot
  certify ingredient exclusions until catalogue details are verified. Preferences remain
  contextual for follow-up; not a claim of clinically validated suitability.

Cards/actions are constructed from actual tool-returned IDs and current catalogue records.
Nothing is auto-added. History is server-HMAC-signed, expiry- and owner-bound; clients cannot
forge tool successes. History is not encrypted; it belongs to the customer's own browser.
Prompt instructs concise answers, catalogue/policy grounding, follow-up questions and medical
boundaries. **A generative system cannot be guaranteed never to hallucinate**: structured
cards/totals/tool actions are server-grounded; live adversarial text evaluation is still due.

## Applied schema

`glowlab` is the deployed application schema in the new project explicitly authorized by the
user. The initial live audit found no application tables. The base and additive migrations create:

| Table | Key fields / relationships |
|---|---|
| categories | `name` PK, timestamp |
| products | existing text `id` PK, name/brand/description/price/image, `category` FK, skin_type, ingredients JSON, usage, details_verified, available, nullable stock, timestamps |
| store_policies | slug PK, title/content/published, timestamps |
| orders | UUID PK, unique reference, private owner_hash, UUID retry key + fingerprint, customer JSON (name/email/phone/address/city/instructions), generated customer/delivery projections, subtotal, total, delivery_fee and generated shipping_fee, currency, independent payment/order/fulfillment statuses, timestamps |
| order_items | UUID PK, order_id FK, product_id FK, product_name/unit_price snapshots, quantity, generated line_total; unique order/product |
| support_tickets | unique ID, private owner_hash, UUID retry key, customer_name/email, issue, optional order_reference FK, priority/status, timestamps |

Guest customer/delivery data lives in private order snapshots, rather than duplicating an
unknown existing customer table. No login/account model was invented. Carts persist locally;
routines persist with conversation session state, so no new cart/routine database tables are
needed for this implementation. No legacy application customer/routine tables were found in the newly authorized project.
Any future imported records must be explicitly reconciled, not overwritten. Indexes cover owner/reference, timestamps, order items, categories
and ticket status/order. Trigger updates timestamps. All six tables enable RLS, with no public
policies. Only service_role gets schema/table privileges and execute on the two mutation RPCs.
No existing schema/data/integrations were deleted. Applied remote versions and preserved-record checks are in LIVE-INTEGRATION.md.

## Future seller/automation connection (not implemented)

Use server-side authenticated authorization, not the customer cookie. Required backend env:
existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or a suitably restricted database role,
audited `SUPABASE_DB_SCHEMA`; never distribute these to seller frontend code. Seller systems
do not need Gemini or the storefront SESSION_SECRET unless sharing guest-verification logic.
Query orders + items, update allowed order_status values, manage products/stock and support
status. Keep snapshot prices immutable. Never change payment_method to imply a real charge.
A separate service can consume created_at/reference/status via secured queries or reviewed
webhooks later. No webhooks, emails, seller login or business analytics were built here.
