-- ==============================================================================
-- SATURN.THRIFTTT — SUPABASE REALTIME CLOUD SCHEMA
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Relics (Inventory & Live Stock Status)
create table if not exists public.relics (
  id text primary key,
  lot text,
  category text,
  badge text,
  title text not null,
  price numeric not null,
  year text,
  tag text,
  barcode text,
  measurements text,
  "desc" text,
  img text,
  is_sold boolean default false,
  created_at timestamp with time zone default now()
);

-- 2. Orders (Store Telemetry & Collector Acquisitions)
create table if not exists public.orders (
  id text primary key,
  date text,
  shipping jsonb,
  items jsonb,
  subtotal numeric,
  discount numeric default 0,
  coupon_code text,
  total numeric not null,
  payment_rail text,
  cod_token_amount numeric default 0,
  cod_balance_amount numeric default 0,
  utr_number text,
  status text default 'Processing // Authentication',
  created_at timestamp with time zone default now()
);

-- 3. Store Configuration (Realtime Flash Banner, Promo Offers & Store Settings)
create table if not exists public.store_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.relics enable row level security;
alter table public.orders enable row level security;
alter table public.store_config enable row level security;

-- Relics Policies (Anyone can read, anyone can claim/update)
drop policy if exists "Allow public read on relics" on public.relics;
create policy "Allow public read on relics" on public.relics for select using (true);

drop policy if exists "Allow public write on relics" on public.relics;
create policy "Allow public write on relics" on public.relics for all using (true);

-- Orders Policies
drop policy if exists "Allow public read on orders" on public.orders;
create policy "Allow public read on orders" on public.orders for select using (true);

drop policy if exists "Allow public insert on orders" on public.orders;
create policy "Allow public insert on orders" on public.orders for insert with check (true);

drop policy if exists "Allow public update on orders" on public.orders;
create policy "Allow public update on orders" on public.orders for update using (true);

-- Store Config Policies
drop policy if exists "Allow public read on store_config" on public.store_config;
create policy "Allow public read on store_config" on public.store_config for select using (true);

drop policy if exists "Allow public write on store_config" on public.store_config;
create policy "Allow public write on store_config" on public.store_config for all using (true);

-- ==============================================================================
-- ENABLE SUPABASE REALTIME REPLICATION
-- ==============================================================================
begin;
  -- Add tables to realtime publication if not already included
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table public.relics, public.orders, public.store_config;
commit;

