-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text unique not null,
  name text not null,
  brand text,
  image_url text,
  category text,
  unit text,
  created_at timestamptz default now()
);

create index if not exists products_barcode_idx on public.products (barcode);

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric not null default 1,
  min_qty numeric default 0,
  updated_at timestamptz default now()
);

create unique index if not exists stock_items_product_id_key on public.stock_items (product_id);

-- v1: personal app, no auth — keep RLS off (default) or use permissive policies if you enable RLS later.
