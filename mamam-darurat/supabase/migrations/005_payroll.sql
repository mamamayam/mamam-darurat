-- =====================================================================
-- Migrasi 005 — Data gaji: tambahan, potongan, saldo awal bulan.
-- Jalankan SEKALI di SQL Editor. Aman diulang.
--
-- Bentuk mengikuti model HRD mamam-kasir (PayrollAddition, PayrollDeduction,
-- saldo awal per '<karyawan>|<yyyy-MM>') supaya migrasi ke B tinggal
-- memetakan tipe data. Absensi TIDAK disimpan di sini: dibaca langsung dari
-- sistem absensi (lihat src/features/payroll/attendanceProvider.js).
--
-- employee_id memakai ON DELETE RESTRICT: karyawan yang masih punya data gaji
-- tidak bisa dihapus (ubah statusnya jadi Resign). Ini disengaja — data gaji
-- adalah uang, tidak boleh hilang diam-diam karena satu tombol hapus.
-- =====================================================================

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

do $$
declare t text;
begin
  foreach t in array array['payroll_additions','payroll_deductions','payroll_opening_balances'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon_all_%s" on %I', t, t);
    execute format('create policy "anon_all_%s" on %I for all to anon using (true) with check (true)', t, t);
  end loop;
end $$;
