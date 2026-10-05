-- =====================================================================
-- Migrasi 002 — Shift (Dompet). Jalankan SEKALI di SQL Editor.
-- Aman diulang (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Keputusan desain (sesuai arahan):
--  * TIDAK ada ledger perpindahan uang. Uang di kurir saat tutup dompet
--    hanya dicatat sebagai SNAPSHOT di laporan shift, lalu semua kembali
--    ke 0 pada dompet berikutnya (tidak ada saldo yang kebawa lintas shift).
--  * Hasil tutup shift DIBEKUKAN di baris shift itu sendiri, supaya
--    riwayat tidak berubah walau data lain diedit kemudian.
-- =====================================================================

-- Karyawan: role (kasir/kurir/...) dan status (aktif/resign), seperti di A.
alter table employees add column if not exists role   text not null default 'kasir';
alter table employees add column if not exists status text not null default 'aktif'
  check (status in ('aktif','resign'));

-- Pemegang uang tunai kurir (COD delivery, atau belanja pakai uang kurir).
-- Nama di-snapshot supaya laporan lama tetap benar walau karyawan berubah.
alter table transactions add column if not exists cash_holder_employee_id uuid references employees(id) on delete set null;
alter table transactions add column if not exists cash_holder_name        text;
alter table expenses     add column if not exists cash_holder_employee_id uuid references employees(id) on delete set null;
alter table expenses     add column if not exists cash_holder_name        text;
alter table expenses     add column if not exists payment_method          text not null default 'Tunai';

-- Shift: siapa yang membuka + snapshot penutupan.
alter table shifts add column if not exists code                     text;   -- mis. DOMPET-3F2A9C1B
alter table shifts add column if not exists opened_by_employee_id    uuid references employees(id) on delete set null;
alter table shifts add column if not exists opened_by_employee_name  text;
alter table shifts add column if not exists expected_cash            integer;   -- saldo seharusnya saat ditutup
alter table shifts add column if not exists difference               integer;   -- aktual - seharusnya
alter table shifts add column if not exists stats_json               jsonb;     -- rincian (penjualan, pengeluaran, dst) dibekukan
alter table shifts add column if not exists courier_snapshot_json    jsonb;     -- uang yang masih di kurir saat tutup

create index if not exists idx_shifts_opened_at on shifts (opened_at desc);
