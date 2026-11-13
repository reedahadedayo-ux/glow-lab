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
