-- =====================================================================
-- Migrasi 008 — Login Supabase Auth, Pengaturan, PIN karyawan.
-- Jalankan SEKALI di SQL Editor project C. Aman diulang.
--
-- 1. app_settings   : pengaturan aplikasi (lama sesi, akses PIN karyawan, dst)
-- 2. employee_pins  : PIN karyawan (hash bergaram) untuk melihat gaji sendiri
-- 3. Kebijakan RLS  : setelah login Supabase, request memakai role
--                     `authenticated`, bukan `anon`. Tanpa policy untuk role itu
--                     SEMUA data akan tampak kosong. Jadi tiap tabel diberi
--                     policy `authenticated` yang sama longgarnya dengan `anon`
--                     (tingkat keamanan "Longgar" yang disepakati).
-- =====================================================================

create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists employee_pins (
  employee_id  uuid primary key references employees(id) on delete cascade,
  salt         text not null,
  pin_hash     text not null,           -- SHA-256(salt:employee_id:pin), bukan PIN asli
  updated_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'categories','menu_items','variant_categories','variant_groups','variant_options',
    'menu_item_variant_groups','customers','vouchers','expense_categories','transactions',
    'transaction_items','expenses','shifts','employees','payroll_additions','payroll_deductions',
    'payroll_opening_balances','payroll_closings','payroll_closing_lines','attendance_overrides',
    'app_settings','employee_pins'
  ] loop
    execute format('alter table %I enable row level security', t);
    -- anon tetap dibuka: mode lama (tanpa login Supabase) dan perangkat yang belum update tetap jalan
    execute format('drop policy if exists "anon_all_%s" on %I', t, t);
    execute format('create policy "anon_all_%s" on %I for all to anon using (true) with check (true)', t, t);
    -- authenticated: dipakai setelah login Supabase
    execute format('drop policy if exists "auth_all_%s" on %I', t, t);
    execute format('create policy "auth_all_%s" on %I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

grant execute on function close_payroll_period(text, date, date, date, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- NANTI, kalau mau database benar-benar tertutup untuk orang yang tidak login
-- (setelah semua perangkat memakai login Supabase): jalankan blok ini.
-- JANGAN dijalankan sekarang kalau env VITE_AUTH_OWNER_EMAIL belum terisi di
-- Vercel, karena aplikasi akan kosong/gagal.
--
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[ ...daftar tabel di atas... ] loop
--     execute format('drop policy if exists "anon_all_%s" on %I', t, t);
--   end loop;
-- end $$;
-- revoke execute on function close_payroll_period(text, date, date, date, text, jsonb) from anon;
-- ---------------------------------------------------------------------
