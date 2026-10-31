# GlowLab Skincare — Klaviyo Abandoned Cart Flow Logic & Delay Configuration

## 1. Flow Overview

The **GlowLab Abandoned Checkout Recovery Flow** in Klaviyo listens for the custom `Checkout Started` metric sent by Make Scenario 1 and guides eligible customers through a two-email reminder sequence with strict purchase suppression and marketing consent enforcement.

---

## 2. Trigger, Flow Filters & Consent Rules

| Setting | Configuration | Purpose |
| :--- | :--- | :--- |
| **Trigger Metric** | `Checkout Started` (API Event) | Enters profile into the flow when they submit the GlowLab checkout form. |
| **Flow Filter 1 (Purchase Suppression)** | `What someone has done` → `Placed Order` → `zero times since starting this flow` | Klaviyo automatically re-evaluates this filter before **every** delay exit and email action. If a `Placed Order` event arrives at any point, the customer is immediately exited from the flow. |
| **Flow Filter 2 (Marketing Consent)** | `Properties about someone` → `marketing_consent` `equals` `true` | Ensures customers who only submitted checkout details for transactional processing (without ticking marketing consent) never receive abandoned-cart marketing emails. |
| **Smart Sending** | Disabled for testing; Enabled (`16 hours`) in production | Prevents over-messaging in production while allowing rapid verification in demo mode. |

---

## 3. Step-by-Step Flow Architecture

```text
[Trigger: Checkout Started]
       │
       ▼
[Flow Filters Checked: marketing_consent == true AND Placed Order == 0 since start]
       │
       ▼
[Time Delay #1]
  • Portfolio Demo Mode: 2–5 minutes
  • Recommended Production: 1 hour
       │
       ▼
[Conditional Split #1: Has Placed Order at least once since starting this flow?]
  ├── YES ──► [Suppress Email 1 & Exit Flow (Converted Before Reminder 1)]
  └── NO  ──► [Send Email #1: "Still thinking about your GlowLab routine?"]
                    │  (Template: email-1-first-reminder.html)
                    ▼
              [Time Delay #2]
                • Portfolio Demo Mode: 5–10 minutes
                • Recommended Production: 23 hours (24 hours total after abandonment)
                    │
                    ▼
              [Conditional Split #2: Has Placed Order at least once since starting this flow?]
                ├── YES ──► [Suppress Email 2 & Exit Flow (Recovered After Reminder 1)]
                └── NO  ──► [Send Email #2: "Still deciding on your skincare routine?"]
                                  │  (Template: email-2-second-reminder.html)
                                  ▼
                            [Exit Flow]
```

---

## 4. Testing Delays vs. Recommended Production Delays

| Flow Stage | Portfolio Demo / Testing Delay | Recommended Production Delay | Rationale |
| :--- | :--- | :--- | :--- |
| **Wait #1 (Before Email 1)** | **2 to 5 minutes** | **1 hour** | In production, 1 hour catches shoppers who were distracted (e.g., looking for their card or checking shipping) while purchase intent is still warm. In demo mode, 2–5 minutes (or instant step-advance in the dashboard) lets reviewers verify the flow during a live walkthrough. |
| **Wait #2 (Before Email 2)** | **5 to 10 minutes** | **23 hours** *(24 hours after checkout start)* | Reaches the customer at the same time of day the next day without feeling pushy or spammy. |

---

## 5. Brand & Ethical Guardrails in Email Content

- **No Misleading Urgency**: Neither Email 1 nor Email 2 claims that stock is "almost gone" or that the cart will "expire in 10 minutes."
- **No Invented Discounts**: Neither email invents unauthorized coupon codes; value is reinforced through product authenticity, Lagos/nationwide delivery clarity, and free routine help from Lumi.
- **Secure Cart Restoration**: Both emails link to `{{ event.extra.checkout_recovery_url }}` (`/checkout.html?recover_checkout=gl_rec_...`), which queries Supabase (`checkouts` + `carts` + `cart_items`) and restores the exact products and quantities into the customer's browser session.
