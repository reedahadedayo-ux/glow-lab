# Repository audit — 2026-11-13

Rollback: `rollback/pre-customer-upgrade-9857747`, commit
`9857747fe44d41e2c64b36ff5dee09de273c9a55`. Working tree was initially clean.
The initial checkout was shallow (one visible commit). Fetched full history without switching
branches: **10 commits**. It records the initial static storefront/image work, Vercel
configuration and five HTML edits. No historical Supabase backend was found; history was preserved.

## Observed architecture

44 tracked files; root static HTML/CSS/vanilla JS and a second `glowlab-skincare/` copy.
Five pages (Home, Products, About, FAQ, Contact), no server, package manifest, Supabase SDK,
SQL, environment files, Edge Functions, cart, checkout or routine persistence. Vercel config
only enabled clean URLs. The repository includes 12 product records in `js/script.js`,
13 local JPGs, modal/filter/FAQ interactions, old external chatbot scripts and placeholder
chat buttons. Contact used a timeout and falsely claimed success; newsletter did likewise.
No Make, Airtable, Klaviyo integrations or Automation page were found to remove. No seller
features, useful backend workflows or existing database records were removed.

## Browser baseline

Started original static website on port 3000. Playwright/Chromium observed 12 product cards,
a working detail modal, and the mobile menu computed `display: none` even after opening.
Baseline screenshot was reviewed. Initial stock/sales/ratings/brand counts were not backed
by data; payment-provider references described functionality that did not exist.

## Reuse / remove / improve

Reuse local imagery, product IDs and demo prices, existing pages and the cream/sage/charcoal
visual language. Remove old chatbot embeds/configuration, fake statistics, false newsletter/
contact success, broken social/hash links, real-payment claims, duplicated storefront code.
Keep duplicate page URLs as redirects. Add server-sourced catalogue, honest verification
labels, working mobile navigation, accessible controls, cart, simulated checkout, confirmed
orders, actual Gemini tool orchestration, session-bound lookup and persisted support.

## Existing Supabase audit: BLOCKED (not fabricated)

The connector returned **disconnected**. No Supabase credentials/project ref or Gemini key
were present in repository/environment. Outbound sandbox hosts do not include Supabase,
Google or the live Vercel site. Therefore **live tables, relationships, record counts, RLS,
Edge Functions, buckets and integrations could not be inspected**. The deployed website
was not verified. Nothing was applied to any Supabase project.

`supabase/INSPECT_FIRST.sql` is the read-only inspection checklist. Record findings here
before applying a migration. The isolated `glowlab` contract is a proposal only. If existing
products/orders/tickets are compatible, adapt `server/supabase-store.js` and its RPCs to them;
do not seed a competing catalogue or duplicate customer tables. No new project was created.
