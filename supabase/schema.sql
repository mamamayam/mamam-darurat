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
--  * Tabel BARU (belum ada di B): shifts. employees mengikuti model HRD A/B
--    (upah per jam). Absensi dibaca dari sistem absensi eksternal.
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
create table if not exists expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

insert into expense_categories (name, sort_order)
values ('Belanja', 0), ('Operasional', 1), ('Gaji', 2), ('Lainnya', 3)
on conflict (name) do nothing;

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

create index if not exists idx_shifts_opened_at on shifts (opened_at desc);

-- ---------------------------------------------------------------------
-- HR: KARYAWAN & ABSENSI — TABEL BARU, belum ada di B
-- ---------------------------------------------------------------------
create table if not exists employees (
  id                       uuid primary key default gen_random_uuid(),
  external_id              text,                    -- id lama (EMP-xxxx) dari mamam-global / sistem absensi
  name                     text not null,
  phone                    text,
  address                  text,
  role                     text not null default 'kasir',   -- 'kasir' | 'kurir'
  status                   text not null default 'aktif'
                             check (status in ('aktif','freelance','cuti','resign')),
  wage_per_hour            integer not null default 0,
  bonus_full_time          integer not null default 0,
  overtime_rate_per_30_min integer not null default 5000,
  start_date               date,
  resign_date              date,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Satu id lama hanya boleh dipakai satu karyawan (mencegah impor ganda).
create unique index if not exists uq_employees_external_id on employees (external_id);

-- Referensi ke karyawan dipasang di sini (bukan di tabelnya masing-masing)
-- karena tabel employees baru dibuat SETELAH transactions/expenses/shifts.
-- ON DELETE SET NULL: menghapus karyawan tidak merusak histori; namanya
-- tetap ada lewat kolom salinan nama. Nama constraint sama dengan yang
-- dibuat migrasi 002, supaya instalasi baru == hasil upgrade.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_cash_holder_employee_id_fkey') then
    alter table transactions add constraint transactions_cash_holder_employee_id_fkey
      foreign key (cash_holder_employee_id) references employees(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_cash_holder_employee_id_fkey') then
    alter table expenses add constraint expenses_cash_holder_employee_id_fkey
      foreign key (cash_holder_employee_id) references employees(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shifts_opened_by_employee_id_fkey') then
    alter table shifts add constraint shifts_opened_by_employee_id_fkey
      foreign key (opened_by_employee_id) references employees(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- DATA GAJI (tambahan, potongan, saldo awal) — model HRD mamam-kasir.
-- employee_id ON DELETE RESTRICT: karyawan dengan data gaji tidak bisa dihapus.
-- Absensi TIDAK disimpan di sini (dibaca dari sistem absensi).
-- ---------------------------------------------------------------------
create table if not exists payroll_additions (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete restrict,
  label        text not null,
  amount       integer not null check (amount > 0),
  date         date not null,
  category     text not null default 'Tambahan',
  source       text not null default 'owner' check (source in ('owner','staff')),
  approved_by  text,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_payroll_additions_emp_date on payroll_additions (employee_id, date);

create table if not exists payroll_deductions (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete restrict,
  label        text not null,
  amount       integer not null check (amount > 0),
  date         date not null,
  category     text not null default 'Potongan',
  created_at   timestamptz not null default now()
);
create index if not exists idx_payroll_deductions_emp_date on payroll_deductions (employee_id, date);

-- Saldo awal bulan: positif = karyawan berutang ke toko; negatif = toko berutang.
create table if not exists payroll_opening_balances (
  employee_id  uuid not null references employees(id) on delete restrict,
  month        text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount       integer not null default 0,
  primary key (employee_id, month)
);


-- ---------------------------------------------------------------------
-- TUTUP PERIODE GAJI (angka gaji dibekukan) — lihat supabase/migrations/006.
-- ---------------------------------------------------------------------
create table if not exists payroll_closings (
  id            uuid primary key default gen_random_uuid(),
  period_type   text not null check (period_type in ('minggu','bulan')),
  period_start  date not null,
  period_end    date not null,
  note          text,
  closed_at     timestamptz not null default now(),
  check (period_end >= period_start),
  unique (period_start, period_end)
);

create table if not exists payroll_closing_lines (
  id                    uuid primary key default gen_random_uuid(),
  closing_id            uuid not null references payroll_closings(id) on delete cascade,
  employee_id           uuid references employees(id) on delete set null,   -- nama tetap ada di employee_name
  employee_name         text not null,
  employee_external_id  text,
  role                  text,
  net_pay               integer not null,
  gross_cost            integer not null,       -- upah kotor untuk Laba Rugi (tanpa kasbon)
  kasbon_total          integer not null default 0,
  rates_json            jsonb not null,         -- tarif saat ditutup: upah/jam, bonus FT, lembur/30 mnt
  payroll_json          jsonb not null          -- hasil hitung lengkap (rincian harian, tambahan, potongan)
);
create index if not exists idx_closing_lines_closing on payroll_closing_lines (closing_id);

create or replace function close_payroll_period(
  p_type text, p_start date, p_end date, p_today date, p_note text, p_lines jsonb
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  if p_type not in ('minggu','bulan') then raise exception 'Jenis periode tidak valid'; end if;
  if p_end < p_start then raise exception 'Periode tidak valid'; end if;
  if p_end >= p_today then raise exception 'Periode belum selesai, belum bisa ditutup'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Tidak ada data gaji untuk ditutup';
  end if;

  insert into payroll_closings (period_type, period_start, period_end, note)
  values (p_type, p_start, p_end, nullif(trim(p_note), ''))
  returning id into v_id;

  insert into payroll_closing_lines
    (closing_id, employee_id, employee_name, employee_external_id, role, net_pay, gross_cost, kasbon_total, rates_json, payroll_json)
  select v_id, nullif(l->>'employee_id','')::uuid, l->>'employee_name', nullif(l->>'employee_external_id',''), l->>'role',
         (l->>'net_pay')::integer, (l->>'gross_cost')::integer, coalesce((l->>'kasbon_total')::integer, 0),
         l->'rates_json', l->'payroll_json'
  from jsonb_array_elements(p_lines) l;

  return v_id;
end $$;

-- Tambahan/potongan di periode tertutup tidak boleh berubah.
create or replace function block_closed_payroll_change() returns trigger language plpgsql as $$
declare d date;
begin
  foreach d in array array[
    case when tg_op in ('UPDATE','DELETE') then old.date end,
    case when tg_op in ('INSERT','UPDATE') then new.date end
  ] loop
    if d is not null and exists (select 1 from payroll_closings c where d between c.period_start and c.period_end) then
      raise exception 'Periode gaji ini sudah ditutup, jadi tambahan/potongan tidak bisa diubah. Buka kembali periodenya dulu kalau perlu koreksi.';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Saldo awal bulan yang sudah ditutup (penutupan jenis 'bulan') tidak boleh berubah.
create or replace function block_closed_opening_balance_change() returns trigger language plpgsql as $$
declare m text;
begin
  foreach m in array array[
    case when tg_op in ('UPDATE','DELETE') then old.month end,
    case when tg_op in ('INSERT','UPDATE') then new.month end
  ] loop
    if m is not null and exists (select 1 from payroll_closings c where c.period_type = 'bulan' and to_char(c.period_start, 'YYYY-MM') = m) then
      raise exception 'Bulan gaji ini sudah ditutup, jadi saldo awal tidak bisa diubah. Buka kembali periodenya dulu kalau perlu koreksi.';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_block_closed_additions on payroll_additions;
create trigger trg_block_closed_additions before insert or update or delete on payroll_additions
  for each row execute function block_closed_payroll_change();
drop trigger if exists trg_block_closed_deductions on payroll_deductions;
create trigger trg_block_closed_deductions before insert or update or delete on payroll_deductions
  for each row execute function block_closed_payroll_change();
drop trigger if exists trg_block_closed_opening on payroll_opening_balances;
create trigger trg_block_closed_opening before insert or update or delete on payroll_opening_balances
  for each row execute function block_closed_opening_balance_change();

grant execute on function close_payroll_period(text, date, date, date, text, jsonb) to anon;


-- Koreksi absensi oleh owner (migrasi 007)
create table if not exists attendance_overrides (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  date         date not null,
  libur        boolean not null default false,
  masuk        text check (masuk  is null or masuk  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  pulang       text check (pulang is null or pulang ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  bolongs      jsonb not null default '[]'::jsonb,    -- [{"from":"13:00","to":"14:00"}]
  note         text,
  updated_at   timestamptz not null default now(),
  unique (employee_id, date)
);
create index if not exists idx_attendance_overrides_date on attendance_overrides (date);

drop trigger if exists trg_block_closed_attendance_overrides on attendance_overrides;
create trigger trg_block_closed_attendance_overrides before insert or update or delete on attendance_overrides
  for each row execute function block_closed_payroll_change();

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
    'menu_item_variant_groups','customers','vouchers','expense_categories','transactions',
    'transaction_items','expenses','shifts','employees','payroll_additions','payroll_deductions','payroll_opening_balances','payroll_closings','payroll_closing_lines','attendance_overrides'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon_all_%s" on %I', t, t);
    execute format(
      'create policy "anon_all_%s" on %I for all to anon using (true) with check (true)', t, t);
  end loop;
end $$;
