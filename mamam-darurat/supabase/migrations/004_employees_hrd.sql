-- =====================================================================
-- Migrasi 004 — Karyawan mengikuti model HRD mamam-global & mamam-kasir.
-- Jalankan SEKALI di SQL Editor. Aman diulang.
--
-- Kenapa: A dan B sama-sama memakai UPAH PER JAM + tarif lembur per 30 menit
-- + bonus full time, dan absensi sebagai baris kejadian (masuk/bolong/
-- pulang/libur) dari sistem absensi terpisah. Skema lama C (daily_rate,
-- attendance_records satu-baris-per-hari) tidak cocok dengan keduanya.
--
-- PERHATIAN (bersifat menghapus):
--  * kolom employees.daily_rate DIHAPUS (tidak dipakai kode mana pun)
--  * tabel attendance_records DIHAPUS (tidak dipakai; absensi nanti dibaca
--    dari sistem absensi eksternal, bukan disalin ke C)
--  Kalau kamu sempat mengisi dua hal itu manual, catat dulu sebelum jalan.
-- =====================================================================

alter table employees add column if not exists external_id              text;      -- id lama (EMP-xxxx) dari mamam-global / sistem absensi
alter table employees add column if not exists phone                    text;
alter table employees add column if not exists address                  text;
alter table employees add column if not exists wage_per_hour            integer not null default 0;
alter table employees add column if not exists bonus_full_time          integer not null default 0;
alter table employees add column if not exists overtime_rate_per_30_min integer not null default 5000;
alter table employees add column if not exists start_date               date;
alter table employees add column if not exists resign_date              date;

-- Satu id lama hanya boleh dipakai satu karyawan (mencegah impor ganda).
-- Baris tanpa id lama (NULL) tidak saling bentrok.
create unique index if not exists uq_employees_external_id on employees (external_id);

-- Status sama seperti A dan B: aktif, freelance, cuti, resign.
alter table employees drop constraint if exists employees_status_check;
alter table employees add constraint employees_status_check
  check (status in ('aktif','freelance','cuti','resign'));

alter table employees drop column if exists daily_rate;
drop table if exists attendance_records;
