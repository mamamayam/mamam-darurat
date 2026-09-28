-- =====================================================================
-- mamam-darurat (Aplikasi C) — Supabase schema, gelombang 1
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> paste
-- seluruh file ini -> Run. Aman dijalankan ulang (IF NOT EXISTS).
--
-- Prinsip:
--  * Nama kolom SAMA dengan mamam-kasir (Flutter) supaya migrasi C -> B
--    tinggal mapping tipe data, bukan ganti struktur.
--    Tipe dinaikkan ke Postgres: TEXT id -> uuid, TEXT tanggal ->
--    timestamptz, INTEGER 0/1 -> boolean, TEXT json -> jsonb.
--  * HARD DELETE. Tidak ada deleted_at / recycle bin.
--  * Uang = integer rupiah (bukan desimal), sama dengan B.
--  * Snapshot: transactions/transaction_items menyimpan angka final
--    saat checkout, tidak dihitung ulang dari harga menu sekarang.
--  * Tabel BARU (belum ada di B): shifts, employees, attendance_records.
--  * expenses meniru cash_expenses B TANPA ledger cash_movements.
-- =====================================================================

-- ---------------------------------------------------------------------
-- MENU
-- ---------------------------------------------------------------------
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists menu_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references categories(id),
  name         text not null,
  price        integer not null,
  hpp          integer,              -- diisi manual oleh admin
  unit         text not null default 'porsi',
  sort_order   integer not null default 0,   -- urutan dalam kategori (drag-urutkan)
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Kategori varian (mis. "Level Pedas", "Topping"). Di B belum ada; di A
-- disimpan sebagai daftar berurutan. Dibuat sebagai tabel supaya urutannya
-- bisa di-drag dan renaming satu tempat.
create table if not exists variant_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists variant_groups (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid references variant_categories(id) on delete set null,
  name           text not null,
  sort_order     integer not null default 0,
  is_required    boolean not null default false,
  max_selection  integer not null default 1,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists variant_options (
  id                uuid primary key default gen_random_uuid(),
  variant_group_id  uuid not null references variant_groups(id) on delete cascade,
  name              text not null,
  extra_price       integer not null default 0,
  sort_order        integer not null default 0
);

-- Satu menu bisa terhubung ke banyak grup varian ("Koneksi Varian")
create table if not exists menu_item_variant_groups (
  menu_item_id      uuid not null references menu_items(id) on delete cascade,
  variant_group_id  uuid not null references variant_groups(id) on delete cascade,
  primary key (menu_item_id, variant_group_id)
);

-- ---------------------------------------------------------------------
-- PELANGGAN & VOUCHER
-- (tanpa poin — poin hidup di project mamam-global, integrasi menyusul)
-- ---------------------------------------------------------------------
create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists vouchers (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  discount_type   text not null check (discount_type in ('percent','fixed')),
  discount_value  integer not null,
  min_purchase    integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TRANSAKSI (POS)
-- ---------------------------------------------------------------------
create table if not exists transactions (
  id                      uuid primary key default gen_random_uuid(),
  display_number          text not null,
  status                  text not null check (status in ('open','paid','canceled')),
  order_type              text not null check (order_type in ('Takeaway','Dine-in','Delivery','Ojol')),
  customer_id             uuid references customers(id) on delete set null,
  customer_name           text,      -- snapshot nama saat transaksi
  ojol_platform           text,
  ojol_order_number       text,
  subtotal                integer not null,
  voucher_id              uuid references vouchers(id) on delete set null,
  voucher_code            text,
  voucher_discount        integer not null default 0,
  manual_discount_type    text check (manual_discount_type in ('percent','fixed')),
  manual_discount_value   integer,
  manual_discount_amount  integer not null default 0,
  tax_amount              integer not null default 0,
  service_amount          integer not null default 0,
  delivery_fee            integer not null default 0,
  rounding_adjustment     integer not null default 0,
  total                   integer not null,
  payment_method          text check (payment_method in ('Tunai','QRIS','Transfer','Ojol','Split Payment')),
  amount_paid             integer,
  change_amount           integer,
  split_payments_json     jsonb,     -- hanya kalau payment_method = 'Split Payment'
  cash_holder_employee_id uuid,      -- kurir yang memegang uang tunai (COD), kalau ada
  cash_holder_name        text,      -- snapshot nama kurir
  created_at              timestamptz not null default now(),
  paid_at                 timestamptz,
  canceled_at             timestamptz,
  cancel_reason           text
);

create table if not exists transaction_items (
  id                     uuid primary key default gen_random_uuid(),
  transaction_id         uuid not null references transactions(id) on delete cascade,
  menu_item_id           uuid not null,   -- sengaja TANPA FK: histori tetap utuh walau menu dihapus
  name                   text not null,   -- snapshot
  variant_name           text,
  variant_selected_json  jsonb,
  price                  integer not null,
  hpp                    integer not null default 0,  -- snapshot, dipakai Laba Rugi
  qty                    integer not null,
  note                   text
);

create index if not exists idx_transactions_created_at on transactions (created_at desc);
create index if not exists idx_transactions_status     on transactions (status);
create index if not exists idx_transaction_items_tx    on transaction_items (transaction_id);

-- ---------------------------------------------------------------------
-- PENGELUARAN / PEMASUKAN LAIN
-- Meniru cash_expenses B, tanpa ledger cash_movements / cash_locations.
-- ---------------------------------------------------------------------
create table if not exists expenses (
  id                      uuid primary key default gen_random_uuid(),
  direction               text not null default 'pengeluaran'
                            check (direction in ('pemasukan','pengeluaran')),
  category                text not null,
  amount                  integer not null,
  transaction_date        date not null default current_date,
  store_or_supplier_name  text,
  detail                  text,
  payment_method          text not null default 'Tunai',
  cash_holder_employee_id uuid,      -- kurir yang membayar pakai uang tunainya, kalau ada
  cash_holder_name        text,
  created_at              timestamptz not null default now(),
  created_by              text
);

create index if not exists idx_expenses_date on expenses (transaction_date desc);

-- ---------------------------------------------------------------------
-- SHIFT (sederhana, angka polos) — TABEL BARU, belum ada di B
-- ---------------------------------------------------------------------
create table if not exists shifts (
  id               uuid primary key default gen_random_uuid(),
  opening_balance  integer not null default 0,
  closing_balance  integer,
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,
  note             text,
  code                    text,     -- mis. DOMPET-3F2A9C1B
  opened_by_employee_id   uuid,
  opened_by_employee_name text,
  expected_cash           integer,  -- saldo seharusnya saat ditutup
  difference              integer,  -- aktual - seharusnya
  stats_json              jsonb,    -- rincian dibekukan saat tutup
  courier_snapshot_json   jsonb     -- uang yang masih di kurir saat tutup (snapshot)
);

-- Hanya boleh ada SATU shift terbuka pada satu waktu. Ini penjaga di level
-- database supaya dua HP yang sama-sama "buka shift" tidak menghasilkan dua
-- shift aktif (akar masalah race condition di app lama).
create unique index if not exists uq_one_open_shift
  on shifts ((closed_at is null)) where closed_at is null;

-- ---------------------------------------------------------------------
-- HR: KARYAWAN & ABSENSI — TABEL BARU, belum ada di B
-- ---------------------------------------------------------------------
create table if not exists employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  daily_rate  integer not null default 0,
  role        text not null default 'kasir',     -- 'kasir' | 'kurir' | ...
  status      text not null default 'aktif' check (status in ('aktif','resign')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists attendance_records (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  date         date not null,
  clock_in     timestamptz,
  clock_out    timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  -- satu karyawan satu baris per hari: cegah data ganda
  unique (employee_id, date)
);

create index if not exists idx_attendance_date on attendance_records (date desc);

-- ---------------------------------------------------------------------
-- RLS
-- Disepakati: BELUM ada auth di C. Policy di bawah membuka akses penuh ke
-- role `anon`, artinya siapa pun yang punya URL + anon key bisa baca/tulis.
-- Ini SEMENTARA. Jangan bagikan URL app ke orang di luar tim, dan ganti
-- dengan policy berbasis login sebelum app dipakai lebih luas.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','menu_items','variant_categories','variant_groups','variant_options',
    'menu_item_variant_groups','customers','vouchers','transactions',
    'transaction_items','expenses','shifts','employees','attendance_records'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon_all_%s" on %I', t, t);
    execute format(
      'create policy "anon_all_%s" on %I for all to anon using (true) with check (true)', t, t);
  end loop;
end $$;
