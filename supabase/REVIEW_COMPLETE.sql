-- GLOWLAB COMPLETE SQL REVIEW PACKAGE — 2026-11-13
-- Project: avebkyxbhwfzvivvcfmb. Contains complete schema, grants/RLS and every function.
-- Read as a package. Do NOT blindly re-run already-applied migrations on the live project.
-- Section 1 already applied as 20261113092946_glowlab_customer_contract.
-- Section 2 already applied as 20261113093042_glowlab_expose_server_schema.
-- Section 3 was shown before application and applied as 20261113093538_glowlab_order_fields.
-- Section 4 is the insert-only seed, already applied; safe DO NOTHING on conflicts.
-- RLS uses NO public policies: no schema usage or table/function grants for anon/authenticated.
-- Only server service_role may read/write; customer API enforces session ownership.
-- No seller dashboard/auth/email workflow is included.


-- 1: ALREADY APPLIED BASE SCHEMA
-- Source: supabase/migrations/20261113092946_glowlab_customer_contract.sql

begin;
create schema if not exists glowlab;
revoke all on schema glowlab from public, anon, authenticated;
grant usage on schema glowlab to service_role;
create table if not exists glowlab.categories (
 name text primary key, created_at timestamptz not null default now()
);
create table if not exists glowlab.products (
 id text primary key,
 name text not null,
 brand text not null,
 description text not null,
 price numeric(12,2) not null check(price>=0),
 image text not null check(image ~ '^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$'),
 category text not null references glowlab.categories(name),
 skin_type text not null default '',
 ingredients jsonb not null default '[]' check(jsonb_typeof(ingredients)='array'),
 usage text,
 details_verified boolean not null default false,
 available boolean not null default false,
 stock integer check(stock>=0), -- NULL = quantity not tracked, never an invented stock number
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists glowlab.store_policies (
 slug text primary key,title text not null,content text not null,published boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists glowlab.orders (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default ('GL-'||upper(replace(gen_random_uuid()::text,'-',''))),
 owner_hash text not null,
 idempotency_key uuid not null,
 request_fingerprint text not null,
 customer jsonb not null check(jsonb_typeof(customer)='object'),
 total numeric(12,2) not null check(total>=0),delivery_fee numeric(12,2) not null default 0 check(delivery_fee=0),
 currency text not null default 'NGN' check(currency='NGN'),
 payment_status text not null default 'paid' check(payment_status in ('paid','refunded')),
 payment_method text not null default 'simulated' check(payment_method='simulated'),
 order_status text not null default 'confirmed' check(order_status in ('confirmed','processing','shipped','delivered','cancelled')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_hash,idempotency_key)
);
create table if not exists glowlab.order_items (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references glowlab.orders(id),
 product_id text not null references glowlab.products(id),product_name text not null,
 quantity integer not null check(quantity between 1 and 20),
 unit_price numeric(12,2) not null check(unit_price>=0),
 line_total numeric(12,2) generated always as (quantity*unit_price) stored,
 unique(order_id,product_id)
);
create table if not exists glowlab.support_tickets (
 id text primary key default ('SUP-'||upper(replace(gen_random_uuid()::text,'-',''))),
 owner_hash text not null,idempotency_key uuid not null,
 customer_name text not null,customer_email text not null,
 issue text not null check(length(issue) between 10 and 3000),
 order_reference text references glowlab.orders(reference),
 priority text not null default 'normal' check(priority in ('normal','high')),
 status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_hash,idempotency_key)
);
create index if not exists orders_owner_reference on glowlab.orders(owner_hash,reference);
create index if not exists orders_created_at on glowlab.orders(created_at desc);
create index if not exists order_items_order on glowlab.order_items(order_id);
create index if not exists tickets_status_created on glowlab.support_tickets(status,created_at desc);
create index if not exists tickets_order on glowlab.support_tickets(order_reference);
create index if not exists products_category on glowlab.products(category);
-- Explicit deny-by-default: no anon or authenticated grants/policies on ANY table.
-- All customer access is via server routes; service_role never enters the frontend.
alter table glowlab.categories enable row level security;
alter table glowlab.products enable row level security;
alter table glowlab.store_policies enable row level security;
alter table glowlab.orders enable row level security;
alter table glowlab.order_items enable row level security;
alter table glowlab.support_tickets enable row level security;
revoke all on all tables in schema glowlab from public, anon, authenticated;
grant select,insert,update,delete on all tables in schema glowlab to service_role;
create or replace function glowlab.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
-- Add triggers without replacing existing triggers.
do $$ declare t text; begin
 foreach t in array array['products','store_policies','orders','support_tickets'] loop
  if not exists(select 1 from pg_trigger where tgname=t||'_customer_updated_at' and tgrelid=('glowlab.'||t)::regclass) then
   execute format('create trigger %I before update on glowlab.%I for each row execute function glowlab.touch_updated_at()',t||'_customer_updated_at',t);
  end if;
 end loop;
end $$;
create or replace function glowlab.create_demo_order(p_owner text,p_customer jsonb,p_items jsonb,p_key uuid,p_fingerprint text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o glowlab.orders; p glowlab.products; i jsonb; q integer; amount numeric(12,2):=0; snapshots jsonb:='[]';
begin
 if length(p_owner)<32 or length(p_fingerprint)<>64 then raise exception 'Invalid session or request fingerprint';end if;
 if jsonb_typeof(p_customer)<>'object' or length(trim(coalesce(p_customer->>'name',''))) not between 2 and 100
 or length(trim(coalesce(p_customer->>'address',''))) not between 5 and 300 or length(trim(coalesce(p_customer->>'city',''))) not between 2 and 100
 or coalesce(p_customer->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(coalesce(p_customer->>'email',''))>254
 or coalesce(p_customer->>'phone','') !~ '^\+?[0-9 ()-]{7,30}$'
 or length(coalesce(p_customer->>'instructions',''))>500
 then raise exception 'Invalid delivery information';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid cart';end if;
 if (select count(distinct value->>'productId') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Duplicate products';end if;
 -- Transaction-scoped advisory lock serializes concurrent retries before checking saved order.
 perform pg_advisory_xact_lock(hashtextextended(p_owner||p_key::text,0));
 select * into o from glowlab.orders where owner_hash=p_owner and idempotency_key=p_key;
 if found then
  if o.request_fingerprint<>p_fingerprint then raise exception 'Checkout key was already used for a different order';end if;
 else
  -- Stable lock order avoids deadlocks across carts. Prices and availability are authoritative.
  for i in select value from jsonb_array_elements(p_items) order by value->>'productId' loop
   if (i->>'quantity') !~ '^[0-9]+$' then raise exception 'Invalid quantity';end if;
   q=(i->>'quantity')::integer;if q not between 1 and 20 then raise exception 'Invalid quantity';end if;
   select * into p from glowlab.products where id=i->>'productId' for update;
   if not found or not p.available or (p.stock is not null and p.stock<q) then raise exception 'A product is unavailable or has insufficient stock';end if;
   amount=amount+p.price*q;
   snapshots=snapshots||jsonb_build_array(jsonb_build_object('product_id',p.id,'product_name',p.name,'quantity',q,'unit_price',p.price));
   if p.stock is not null then update glowlab.products set stock=stock-q where id=p.id;end if;
  end loop;
  insert into glowlab.orders(owner_hash,idempotency_key,request_fingerprint,customer,total,payment_status,payment_method,order_status)
  values(p_owner,p_key,p_fingerprint,p_customer,amount,'paid','simulated','confirmed') returning * into o;
  insert into glowlab.order_items(order_id,product_id,product_name,quantity,unit_price)
  select o.id,x->>'product_id',x->>'product_name',(x->>'quantity')::integer,(x->>'unit_price')::numeric from jsonb_array_elements(snapshots) x;
 end if;
 return (to_jsonb(o)-'owner_hash'-'idempotency_key'-'request_fingerprint')||jsonb_build_object('items',(select jsonb_agg(jsonb_build_object('product_id',product_id,'product_name',product_name,'quantity',quantity,'unit_price',unit_price,'line_total',line_total)) from glowlab.order_items where order_id=o.id));
end $$;
create or replace function glowlab.create_customer_ticket(p_owner text,p_input jsonb,p_key uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t glowlab.support_tickets; ref text:=nullif(upper(p_input->>'orderReference'),'');
begin
 if length(p_owner)<32 or length(coalesce(p_input->>'name','')) not between 2 and 100
 or length(coalesce(p_input->>'issue','')) not between 10 and 3000
 or coalesce(p_input->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(p_input->>'email')>254 or coalesce(p_input->>'priority','normal') not in ('normal','high') then raise exception 'Invalid support details';end if;
 if ref is not null and not exists(select 1 from glowlab.orders where reference=ref and owner_hash=p_owner and customer->>'email'=lower(p_input->>'email')) then raise exception 'Order not found or could not be verified';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner||p_key::text,1));
 select * into t from glowlab.support_tickets where owner_hash=p_owner and idempotency_key=p_key;
 if not found then
  insert into glowlab.support_tickets(owner_hash,idempotency_key,customer_name,customer_email,issue,order_reference,priority)
  values(p_owner,p_key,p_input->>'name',lower(p_input->>'email'),p_input->>'issue',ref,coalesce(p_input->>'priority','normal')) returning * into t;
 end if;
 return jsonb_build_object('id',t.id,'name',t.customer_name,'email',t.customer_email,'issue',t.issue,'orderReference',t.order_reference,'priority',t.priority,'status',t.status,'created_at',t.created_at);
end $$;
revoke all on all functions in schema glowlab from public, anon, authenticated;
grant execute on function glowlab.create_demo_order(text,jsonb,jsonb,uuid,text) to service_role;
grant execute on function glowlab.create_customer_ticket(text,jsonb,uuid) to service_role;
commit;
-- If adopted: add glowlab to Supabase Data API exposed schemas (not anon grants).


-- 2: ALREADY APPLIED REST SCHEMA CONFIGURATION
-- Source: supabase/migrations/20261113093042_glowlab_expose_server_schema.sql

-- Already applied remotely as 20261113093042_glowlab_expose_server_schema.
-- Schema visibility does NOT grant anon/authenticated usage, table access or function execution.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,graphql_public,glowlab';
NOTIFY pgrst, 'reload config';


-- 3: ADDITIVE CORRECTION — APPLIED AFTER REVIEW
-- Source: supabase/migrations/20261113093538_glowlab_order_fields.sql

-- Additive correction reviewed against the deployed GlowLab schema.
-- Preserves products/IDs/prices/images, order references, customer JSON and item snapshots.
-- Backfills only missing new fields; no table/column/data is dropped.
BEGIN;
ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS fulfillment_status text;
UPDATE glowlab.orders SET fulfillment_status = CASE
 WHEN order_status = 'shipped' THEN 'shipped'
 WHEN order_status = 'delivered' THEN 'delivered'
 WHEN order_status = 'cancelled' THEN 'cancelled'
 ELSE 'unfulfilled' END
WHERE fulfillment_status IS NULL;
ALTER TABLE glowlab.orders ALTER COLUMN fulfillment_status SET DEFAULT 'unfulfilled';
ALTER TABLE glowlab.orders ALTER COLUMN fulfillment_status SET NOT NULL;

ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS subtotal numeric(12,2);
UPDATE glowlab.orders SET subtotal = total - delivery_fee WHERE subtotal IS NULL;
ALTER TABLE glowlab.orders ALTER COLUMN subtotal SET NOT NULL;
-- Backwards-compatible shipping_fee alias: one authoritative stored fee, no conflicting copies.
-- Demo delivery_fee remains constrained to zero by the original contract.
ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2)
 GENERATED ALWAYS AS (delivery_fee) STORED;
-- Queryable customer/delivery columns are generated from the private purchase snapshot.
-- This avoids discrepancies between JSON and separate seller-facing columns.
ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS customer_name text
 GENERATED ALWAYS AS (customer->>'name') STORED;
ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS customer_email text
 GENERATED ALWAYS AS (customer->>'email') STORED;
ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS customer_phone text
 GENERATED ALWAYS AS (customer->>'phone') STORED;
ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS delivery_address text
 GENERATED ALWAYS AS (customer->>'address') STORED;
ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS delivery_city text
 GENERATED ALWAYS AS (customer->>'city') STORED;
ALTER TABLE glowlab.orders ADD COLUMN IF NOT EXISTS delivery_instructions text
 GENERATED ALWAYS AS (customer->>'instructions') STORED;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='glowlab.orders'::regclass AND conname='orders_fulfillment_status_check') THEN
  ALTER TABLE glowlab.orders ADD CONSTRAINT orders_fulfillment_status_check
   CHECK (fulfillment_status IN ('unfulfilled','processing','shipped','delivered','cancelled'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='glowlab.orders'::regclass AND conname='orders_subtotal_check') THEN
  ALTER TABLE glowlab.orders ADD CONSTRAINT orders_subtotal_check CHECK (subtotal >= 0);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='glowlab.orders'::regclass AND conname='orders_total_components_check') THEN
  ALTER TABLE glowlab.orders ADD CONSTRAINT orders_total_components_check
   CHECK (total = subtotal + shipping_fee);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS orders_fulfillment_created ON glowlab.orders(fulfillment_status, created_at DESC);

create or replace function glowlab.create_demo_order(p_owner text,p_customer jsonb,p_items jsonb,p_key uuid,p_fingerprint text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o glowlab.orders; p glowlab.products; i jsonb; q integer; amount numeric(12,2):=0; snapshots jsonb:='[]';
begin
 if p_owner is null or length(p_owner)<32 or p_key is null or p_fingerprint is null or length(p_fingerprint)<>64 then raise exception 'Invalid session or request fingerprint';end if;
 if p_customer is null or jsonb_typeof(p_customer)<>'object' or length(trim(coalesce(p_customer->>'name',''))) not between 2 and 100
 or length(trim(coalesce(p_customer->>'address',''))) not between 5 and 300 or length(trim(coalesce(p_customer->>'city',''))) not between 2 and 100
 or coalesce(p_customer->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(coalesce(p_customer->>'email',''))>254
 or coalesce(p_customer->>'phone','') !~ '^\+?[0-9 ()-]{7,30}$'
 or length(coalesce(p_customer->>'instructions',''))>500
 then raise exception 'Invalid delivery information';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid cart';end if;
 if (select count(distinct value->>'productId') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Duplicate products';end if;
 -- Transaction-scoped advisory lock serializes concurrent retries before checking saved order.
 perform pg_advisory_xact_lock(hashtextextended(p_owner||p_key::text,0));
 select * into o from glowlab.orders where owner_hash=p_owner and idempotency_key=p_key;
 if found then
  if o.request_fingerprint<>p_fingerprint then raise exception 'Checkout key was already used for a different order';end if;
 else
  -- Stable lock order avoids deadlocks across carts. Prices and availability are authoritative.
  for i in select value from jsonb_array_elements(p_items) order by value->>'productId' loop
   if i->>'quantity' is null or (i->>'quantity') !~ '^[0-9]+$' then raise exception 'Invalid quantity';end if;
   q=(i->>'quantity')::integer;if q not between 1 and 20 then raise exception 'Invalid quantity';end if;
   select * into p from glowlab.products where id=i->>'productId' for update;
   if not found or not p.available or (p.stock is not null and p.stock<q) then raise exception 'A product is unavailable or has insufficient stock';end if;
   amount=amount+p.price*q;
   snapshots=snapshots||jsonb_build_array(jsonb_build_object('product_id',p.id,'product_name',p.name,'quantity',q,'unit_price',p.price));
   if p.stock is not null then update glowlab.products set stock=stock-q where id=p.id;end if;
  end loop;
  insert into glowlab.orders(owner_hash,idempotency_key,request_fingerprint,customer,subtotal,total,delivery_fee,payment_status,payment_method,order_status,fulfillment_status)
  values(p_owner,p_key,p_fingerprint,p_customer,amount,amount,0,'paid','simulated','confirmed','unfulfilled') returning * into o;
  insert into glowlab.order_items(order_id,product_id,product_name,quantity,unit_price)
  select o.id,x->>'product_id',x->>'product_name',(x->>'quantity')::integer,(x->>'unit_price')::numeric from jsonb_array_elements(snapshots) x;
 end if;
 return (to_jsonb(o)-'owner_hash'-'idempotency_key'-'request_fingerprint')||jsonb_build_object('items',(select jsonb_agg(jsonb_build_object('product_id',product_id,'product_name',product_name,'quantity',quantity,'unit_price',unit_price,'line_total',line_total)) from glowlab.order_items where order_id=o.id));
end $$;
-- Explicitly retain deny-by-default RLS after adding customer projection columns.
ALTER TABLE glowlab.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON glowlab.orders FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION glowlab.create_demo_order(text,jsonb,jsonb,uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION glowlab.create_demo_order(text,jsonb,jsonb,uuid,text) TO service_role;
COMMIT;


-- 4: INSERT-ONLY ORIGINAL DEMO CATALOGUE AND POLICIES
-- Source: supabase/seed.sql

-- Insert-only seed for the user-approved NEW GlowLab demo project.
BEGIN;
INSERT INTO glowlab.categories(name) VALUES ('Cleansers'),('Moisturizers'),('Sunscreens'),('Serums'),('Exfoliants'),('Treatments') ON CONFLICT (name) DO NOTHING;
INSERT INTO glowlab.products(id,name,brand,price,image,category,skin_type,description,ingredients,usage,details_verified,available,stock) VALUES
('cerave-foaming','CeraVe Foaming Facial Cleanser','CeraVe',14500,'cerave-foaming-cleanser.jpg','Cleansers','Oily, Combination','CeraVe cleanser from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('cetaphil-gentle','Cetaphil Gentle Skin Cleanser','Cetaphil',13200,'cetaphil-cleanser.jpg','Cleansers','Sensitive, Dry','Cetaphil cleanser from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('cerave-cream','CeraVe Moisturizing Cream','CeraVe',17800,'cerave-moisturizing-cream.jpg','Moisturizers','Dry, Sensitive','CeraVe moisturizer from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('neutrogena-hydro','Neutrogena Hydro Boost Water Gel','Neutrogena',12500,'neutrogena-hydro-boost.jpg','Moisturizers','Oily, Combination','Neutrogena moisturizer from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('boj-relief-sun','Beauty of Joseon Relief Sun SPF50+','Beauty of Joseon',15200,'beauty-of-joseon-relief-sun.jpg','Sunscreens','All Skin Types','Beauty of Joseon sunscreen from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('lrp-anthelios','La Roche-Posay Anthelios SPF50+','La Roche-Posay',18900,'lrp-anthelios.jpg','Sunscreens','Sensitive, Oily','La Roche-Posay sunscreen from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('eucerin-oil-control','Eucerin Oil Control SPF50+','Eucerin',16300,'eucerin-oil-control.jpg','Sunscreens','Oily, Acne-Prone','Eucerin sunscreen from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('ordinary-niacinamide','The Ordinary Niacinamide 10% + Zinc','The Ordinary',9800,'the-ordinary-niacinamide.jpg','Serums','Oily, Combination','The Ordinary serum from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('cosrx-snail','COSRX Snail Mucin Essence','COSRX',14200,'cosrx-snail-mucin.jpg','Serums','Dry, Dull, Sensitive','COSRX serum from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('garnier-vitc','Garnier Vitamin C Serum','Garnier',8900,'garnier-vitamin-c.jpg','Serums','All, Dull','Garnier serum from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('paulas-bha','Paula’s Choice 2% BHA Liquid Exfoliant','Paula’s Choice',21500,'paulas-choice-bha.jpg','Exfoliants','Oily, Acne-Prone, Combo','Paula’s Choice exfoliant from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL),
('skin1004-centella','Skin1004 Centella Ampoule','Skin1004',13800,'skin1004-centella.jpg','Treatments','Sensitive, Acne-Prone','Skin1004 treatment from the existing GlowLab demo catalogue.','[]',NULL,false,true,NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO glowlab.store_policies(slug,title,content,published) VALUES
('delivery','Demo delivery','This is a demonstration. No products are physically dispatched. The original storefront described Lagos delivery in 1–3 business days and outside Lagos in 3–7 business days; these are illustrative, not a shipping commitment. Demo delivery fee is ₦0. No courier tracking, SMS or email is sent.',true),
('returns','Demo returns','The original demo policy allows unopened products in original packaging within 7 days of delivery. Opened skincare is excluded unless damaged in transit. Report damage within 48 hours. In this demo, submit a support ticket; no physical return is processed.',true),
('refunds','Demo refunds','No money is collected, so no monetary refund can be issued. A refund request can be recorded as a support ticket. No real-world refund time frame is published.',true),
('cancellation','Demo cancellation','Ask Lumi or use Contact to record a cancellation request. A request does not automatically change an order status. No real-world cancellation deadline is published.',true),
('payment','Simulated payment only','Checkout creates a demo order with payment_status paid, payment_method simulated and order_status confirmed. No real money is charged. Do not enter card or bank details.',true),
('privacy','Demo data and privacy','Use fictional delivery details for this demo. Orders are accessible only from the browser session that created them, with the checkout email for order lookup. Losing the browser session requires support; email alone does not unlock an order. Lumi messages are sent to Google Gemini to answer your request. Do not share sensitive medical or payment information. Cart data stays in your browser. Support tickets and demo orders are saved in the configured database. No marketing emails are sent.',true)
ON CONFLICT (slug) DO NOTHING;
COMMIT;
