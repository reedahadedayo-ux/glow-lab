-- ============================================================================
-- GlowLab Skincare: E-Commerce Abandoned Cart Recovery Automation Schema
-- Database: Supabase PostgreSQL
-- Migration: 001_glowlab_ecommerce_automation.sql
-- ============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. PRODUCTS TABLE (Server-side source of truth for prices & product metadata)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  compare_price INTEGER CHECK (compare_price IS NULL OR compare_price >= price),
  currency TEXT NOT NULL DEFAULT 'NGN',
  category TEXT NOT NULL,
  image TEXT NOT NULL,
  skin_type TEXT,
  concern TEXT,
  short_desc TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. CUSTOMERS TABLE (Includes explicit marketing consent tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_updated_at TIMESTAMPTZ,
  klaviyo_profile_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (LOWER(email));

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. CARTS TABLE
-- Statuses: active | checkout_started | abandoned | recovered | purchased
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'checkout_started', 'abandoned', 'recovered', 'purchased')),
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_customer_id ON public.carts (customer_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON public.carts (status);

CREATE TRIGGER trg_carts_updated_at
BEFORE UPDATE ON public.carts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. CART ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 50),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cart_product UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items (cart_id);

CREATE TRIGGER trg_cart_items_updated_at
BEFORE UPDATE ON public.cart_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. CHECKOUTS TABLE
-- Statuses: pending | converted | abandoned | expired
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  delivery_state TEXT,
  delivery_address TEXT,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal INTEGER NOT NULL CHECK (subtotal > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  item_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery_token TEXT NOT NULL UNIQUE,
  recovery_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'abandoned', 'expired')),
  first_reminder_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (first_reminder_status IN ('pending', 'scheduled', 'sent', 'suppressed', 'skipped_no_consent')),
  first_reminder_sent_at TIMESTAMPTZ,
  second_reminder_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (second_reminder_status IN ('pending', 'scheduled', 'sent', 'suppressed', 'skipped_no_consent')),
  second_reminder_sent_at TIMESTAMPTZ,
  purchase_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (purchase_status IN ('unpaid', 'simulated_purchase')),
  recovery_outcome TEXT NOT NULL DEFAULT 'awaiting_customer'
    CHECK (recovery_outcome IN (
      'awaiting_customer',
      'converted_before_reminder_1',
      'recovered_after_reminder_1',
      'recovered_after_reminder_2',
      'abandoned_unpaid',
      'no_marketing_consent'
    )),
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkouts_cart_id ON public.checkouts (cart_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_customer_email ON public.checkouts (LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_checkouts_status ON public.checkouts (status);
CREATE INDEX IF NOT EXISTS idx_checkouts_recovery_token ON public.checkouts (recovery_token);

CREATE TRIGGER trg_checkouts_updated_at
BEFORE UPDATE ON public.checkouts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 6. ORDERS TABLE (Demo / Simulated Orders)
-- Statuses: simulated | completed
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  checkout_id UUID NOT NULL UNIQUE REFERENCES public.checkouts(id) ON DELETE RESTRICT,
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  total_amount INTEGER NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'simulated'
    CHECK (status IN ('simulated', 'completed')),
  is_demo_simulation BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_checkout_id ON public.orders (checkout_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders (LOWER(customer_email));

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. AUTOMATION EVENTS TABLE (Idempotency, Make & Klaviyo Dispatch Log)
-- Statuses: pending | processed | failed
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('Checkout Started', 'Placed Order', 'Recovery Email 1', 'Recovery Email 2')),
  checkout_id UUID REFERENCES public.checkouts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  cart_id UUID REFERENCES public.carts(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  payload JSONB NOT NULL,
  klaviyo_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  make_response_code INTEGER,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_checkout_id ON public.automation_events (checkout_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_status ON public.automation_events (status);
CREATE INDEX IF NOT EXISTS idx_automation_events_event_type ON public.automation_events (event_type);

CREATE TRIGGER trg_automation_events_updated_at
BEFORE UPDATE ON public.automation_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

-- Products are publicly readable by storefront visitors; writes restricted to service_role
CREATE POLICY "Allow public read access to active products"
  ON public.products
  FOR SELECT
  USING (active = TRUE);

-- All customer, cart, checkout, order, and event writes/reads are mediated
-- through Supabase Edge Functions / Server API using service_role credentials.
-- Service role automatically bypasses RLS, preventing any client-side price tampering,
-- fake order creation, or unauthorized customer data exposure.
