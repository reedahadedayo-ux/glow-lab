-- Applied to the explicitly authorized NEW GlowLab project as 20261113092946.
-- Baseline preserved for migration history; latest order fields are in glowlab_order_fields.
-- Initial read-only audit found no application tables. No existing tables or data dropped.
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
