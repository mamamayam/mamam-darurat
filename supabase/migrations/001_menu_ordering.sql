-- =====================================================================
-- Migrasi 001 — jalankan SEKALI di SQL Editor kalau schema.sql versi
-- pertama sudah pernah dijalankan. Aman diulang (IF NOT EXISTS).
--
-- Menambah: menu_items.sort_order, variant_categories, dan
-- variant_groups.category_id + sort_order, untuk fitur drag-urutkan
-- di Manajemen Menu.
-- =====================================================================

alter table menu_items add column if not exists sort_order integer not null default 0;

create table if not exists variant_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table variant_groups add column if not exists category_id uuid references variant_categories(id) on delete set null;
alter table variant_groups add column if not exists sort_order  integer not null default 0;

alter table variant_categories enable row level security;
drop policy if exists "anon_all_variant_categories" on variant_categories;
create policy "anon_all_variant_categories" on variant_categories
  for all to anon using (true) with check (true);
