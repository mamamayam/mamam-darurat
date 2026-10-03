-- =====================================================================
-- Migrasi 003 — tabel kategori pengeluaran (persisten, termasuk kategori
-- yang belum dipakai transaksi apa pun). Jalankan SEKALI di SQL Editor.
-- Aman diulang.
-- =====================================================================

create table if not exists expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

insert into expense_categories (name, sort_order)
values ('Belanja', 0), ('Operasional', 1), ('Gaji', 2), ('Lainnya', 3)
on conflict (name) do nothing;

alter table expense_categories enable row level security;
drop policy if exists "anon_all_expense_categories" on expense_categories;
create policy "anon_all_expense_categories" on expense_categories
  for all to anon using (true) with check (true);
