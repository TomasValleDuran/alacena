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

-- Shopping list. Rows can be linked to a catalog product (auto-added from low
-- stock) or be free text (manually added things not yet in the pantry).
create table if not exists public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  name text,
  quantity numeric not null default 1,
  checked boolean not null default false,
  created_at timestamptz default now()
);

-- one row per catalog product, so "agregar los que faltan" never duplicates;
-- free-text items (product_id null) are exempt from the constraint.
create unique index if not exists shopping_list_product_key
  on public.shopping_list (product_id) where product_id is not null;

-- v1: personal app, no auth — keep RLS off (default) or use permissive policies if you enable RLS later.
