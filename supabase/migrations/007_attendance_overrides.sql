-- =====================================================================
-- Migrasi 007 — Koreksi absensi oleh owner.
-- Jalankan SEKALI di SQL Editor project C. Aman diulang.
--
-- Data absensi dibaca dari sistem absensi (BACA-SAJA). Koreksi owner disimpan
-- DI SINI, satu baris per karyawan per tanggal, dan MENGGANTIKAN seluruh log
-- absensi hari itu saat dihitung. Menghapus baris = kembali ke data absensi.
-- Koreksi pada tanggal di periode gaji yang sudah ditutup ditolak (sama seperti
-- tambahan/potongan); buka kembali periodenya dulu kalau perlu koreksi.
-- =====================================================================

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

alter table attendance_overrides enable row level security;
drop policy if exists "anon_all_attendance_overrides" on attendance_overrides;
create policy "anon_all_attendance_overrides" on attendance_overrides for all to anon using (true) with check (true);
