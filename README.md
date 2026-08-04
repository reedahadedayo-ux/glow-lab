# GlowLab Skincare — Premium Nigerian Skincare Demo

> **Fictional brand created to demonstrate an AI-powered customer support and shopping assistant built with Botpress.**

A production-quality, premium static website for a modern skincare retailer based in Lagos, Nigeria. Clean, calm, trustworthy and beginner-friendly — designed to showcase an AI advisor called **Lumi**.

![GlowLab — Premium Design](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20Vanilla%20JS-sage)
![Status](https://img.shields.io/badge/Status-Portfolio%20Ready-white)
![Location](https://img.shields.io/badge/Location-Lagos%2C%20Nigeria-charcoal)

---

## ✨ What This Is

Portfolio demo for an **AI Automation Specialist**:

- Realistic e-commerce frontend for skincare (CeraVe, La Roche-Posay, Beauty of Joseon, The Ordinary, COSRX, etc.)
- Premium design: White + Warm Cream + Sage Green + Charcoal, lots of whitespace, rounded corners, soft shadows
- AI assistant **Lumi** (placeholder for Botpress widget) — helps find products, build routines, explain ingredients, answer FAQs, escalate medical concerns
- 100% static — deployable to GitHub Pages & Vercel — zero backend

**Fictional note:** All products, prices (NGN), testimonials and business details are simulated for demo purposes.

---

## 🎨 Brand System

- **Brand:** Professional, friendly, calm, trustworthy, educational, modern, premium, approachable
- **Colors:** White `#FFFFFF`, Warm Cream `#FDF8F3`, Sage `#9AB19F`, Charcoal `#1E2328`
- **Typography:** Outfit (headings) + Plus Jakarta Sans (body)
- **Vibe:** Minimalist, fast, mobile-first, elegant spacing

---

## 📦 Tech Stack

Only:

- HTML5 (semantic)
- CSS3 (custom design system — no Tailwind/Bootstrap)
- Vanilla JavaScript

No frameworks. No build step.

---

## 📁 Project Structure

```
glowlab-skincare/
├── index.html          # Hero, categories, featured products, why GlowLab, Meet Lumi
├── products.html       # Full 12-product grid + filters
├── about.html          # Story, values, Lumi showcase
├── faq.html            # Accordion FAQ + categories
├── contact.html        # Form + info + hours
├── css/
│   └── style.css       # Design system + all sections + responsive
├── js/
│   └── script.js       # Products data, rendering, filters, modal, FAQ, reveal
├── images/             # Product images + hero
│   ├── hero.jpg
│   ├── cerave-foaming-cleanser.jpg
│   ├── cetaphil-cleanser.jpg
│   ├── cerave-moisturizing-cream.jpg
│   ├── neutrogena-hydro-boost.jpg
│   ├── beauty-of-joseon-relief-sun.jpg
│   ├── lrp-anthelios.jpg
│   ├── eucerin-oil-control.jpg
│   ├── the-ordinary-niacinamide.jpg
│   ├── cosrx-snail-mucin.jpg
│   ├── garnier-vitamin-c.jpg
│   ├── paulas-choice-bha.jpg
│   └── skin1004-centella.jpg
└── README.md
```

---

## 🛍️ Featured Products (12)

| Product | Image | Category |
|---------|-------|----------|
| CeraVe Foaming Facial Cleanser | `cerave-foaming-cleanser.jpg` | Cleansers |
| Cetaphil Gentle Skin Cleanser | `cetaphil-cleanser.jpg` | Cleansers |
| CeraVe Moisturizing Cream | `cerave-moisturizing-cream.jpg` | Moisturizers |
| Neutrogena Hydro Boost Water Gel | `neutrogena-hydro-boost.jpg` | Moisturizers |
| Beauty of Joseon Relief Sun SPF50+ | `beauty-of-joseon-relief-sun.jpg` | Sunscreens |
| La Roche-Posay Anthelios SPF50+ | `lrp-anthelios.jpg` | Sunscreens |
| Eucerin Oil Control SPF50+ | `eucerin-oil-control.jpg` | Sunscreens |
| The Ordinary Niacinamide 10% + Zinc | `the-ordinary-niacinamide.jpg` | Serums |
| COSRX Snail Mucin Essence | `cosrx-snail-mucin.jpg` | Serums |
| Garnier Vitamin C Serum | `garnier-vitamin-c.jpg` | Serums |
| Paula’s Choice 2% BHA Liquid | `paulas-choice-bha.jpg` | Exfoliants |
| Skin1004 Centella Ampoule | `skin1004-centella.jpg` | Treatments |

Each card shows: image, name, brand, NGN price, description, skin type, concern, View Details modal.

---

## 🤖 Meet Lumi — AI Skincare Advisor

Included on all pages via `data-chat-lumi` buttons.

Section contains:

```html
<!-- BOTPRESS CHAT WIDGET GOES HERE -->
```

**Lumi helps with:**

- Find right products by skin type/budget
- Build AM/PM routines
- Recommend for acne, hyperpigmentation, oily/dry/sensitive/combo
- Explain ingredients (niacinamide, vitamin C, retinol, BHA...)
- Answer shipping/returns/payments
- Escalate medical concerns → human
- Never diagnoses medical conditions

**Botpress integration (after deploy):**

1. Create Botpress bot → Channels → Webchat → Copy embed code
2. Paste script before `</body>` on all pages, replacing the placeholder comment
3. Test: “I have oily skin and dark spots”

---

## 🚀 Deploy

### GitHub Pages
- Repo root must contain `index.html` (this repo does)
- Settings → Pages → Deploy from branch `main` → root

### Vercel
- Import GitHub repo → Framework: Other → Build command empty → Deploy
- Works instantly — pure static

---

## 📸 How to Upload Product Images to Git

### Option A — Drag & Drop (Simplest for portfolio)

1. Generate or download 12 product images + hero.jpg (1080x1350 recommended)
2. Rename exactly as in table above (e.g., `beauty-of-joseon-relief-sun.jpg`)
3. In GitHub web → `images/` folder → **Add file → Upload files** → drag all → Commit
4. OR locally:

```bash
git add images/
git commit -m "Add GlowLab product images"
git push origin main
```

### Option B — Using this workspace

This project will auto-generate premium placeholder images via AI (already scripted). Images will appear in `images/` and be git-tracked. If you have real product packshots (make sure rights allow), just replace files keeping names.

**Tip:** Use WebP for speed, or keep JPG. Compress with TinyPNG before upload.

The JS already has `onerror` fallback to placeholder if an image is missing, so site never breaks.

---

## 🔧 Customization

- **Prices:** Edit `PRODUCTS` array in `js/script.js`
- **Add product:** Push new object to `PRODUCTS` with same keys
- **Colors:** Edit `:root` vars in `css/style.css`
- **FAQ:** Add new `.faq-item` with `data-category="..."`
- **Lumi copy:** Edit sections with id `lumi`

---

## 📄 Sections Implemented

- Sticky nav (mobile hamburger, active link)
- Hero with proof avatars + floating cards
- Categories (6)
- Featured products (filterable, 8 on homepage, modal detail)
- Why Choose GlowLab (6 points)
- Meet Lumi (chat preview + placeholder)
- Newsletter trust bar
- Products page — all 12 + filters
- About page — story + stats + values
- FAQ page — accordion + category filter (shipping, returns, payments, acne, sunscreen, vitamin C, retinol, etc.)
- Contact page — form + email/phone/Lagos/business hours/socials
- Footer — Instagram, LinkedIn, TikTok, Privacy, Terms, FAQ + fictional note
- Scroll reveal, smooth scroll, back-to-top, toast

---

## 👩‍💻 Portfolio Angle

Use this for your AI Automation pitch:

> “I built GlowLab, a premium Nigerian skincare demo, to showcase how Botpress AI agent Lumi can handle 80% of customer questions — product discovery, routine building, ingredient explanations, shipping FAQs — while escalating medical concerns to humans. Frontend is 100% vanilla, fast and conversion-focused.”

Loom script: Home → Filter products → Open modal → Show Lumi section → Ask Lumi “oily skin + hyperpigmentation” → Contact form.

---

## 📎 License

Demo for portfolio — no commercial use of brand trademarks. All brand names belong to their owners. Site design original.

---

**Built in Lagos with 🤍 + Sage Green.**

