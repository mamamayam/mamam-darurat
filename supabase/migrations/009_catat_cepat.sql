-- =====================================================================
-- Migrasi 009 — Catat Cepat di Beranda: persetujuan Tambahan + potongan
-- yang otomatis tercatat sebagai pengeluaran karyawan.
-- Jalankan SEKALI di SQL Editor. Aman diulang.
--
-- 1) payroll_additions: status persetujuan. Staf mengajukan -> 'menunggu';
--    owner memutuskan -> 'disetujui' / 'ditolak'. Gaji HANYA menghitung yang
--    'disetujui'. Baris lama otomatis 'disetujui' (angka gaji lama tidak berubah).
-- 2) expenses.employee_id/employee_name: penanda pengeluaran karyawan
--    (kasbon, ganti rugi, denda, dll) — dipakai kartu "Pengeluaran Karyawan"
--    di Beranda. Kosong = pengeluaran toko.
-- 3) payroll_deductions.expense_id: tautan potongan <-> pengeluarannya.
--    Menghapus pengeluaran ikut menghapus potongannya (ON DELETE CASCADE);
--    menghapus potongan dari Penggajian menghapus pengeluarannya (diatur aplikasi).
-- 4) catat_potongan(): menulis potongan + pengeluaran dalam SATU transaksi,
--    jadi tidak mungkin ada potongan tanpa pengeluaran (atau sebaliknya).
--    Pembayaran 'Tunai' otomatis mengurangi saldo Dompet (Dompet menghitung
--    pengeluaran bermetode Tunai sejak shift dibuka).
--
-- Penutupan periode gaji tetap berlaku: trigger lama menolak tambah/ubah/hapus
-- tambahan & potongan bertanggal di periode yang sudah ditutup.
-- =====================================================================

alter table payroll_additions
  add column if not exists status text not null default 'disetujui'
    check (status in ('menunggu','disetujui','ditolak'));
alter table payroll_additions add column if not exists requested_by text;     -- nama yang mencatat (staf)
alter table payroll_additions add column if not exists reject_reason text;
create index if not exists idx_payroll_additions_pending on payroll_additions (created_at) where status = 'menunggu';

alter table expenses add column if not exists employee_id uuid references employees(id) on delete set null;
alter table expenses add column if not exists employee_name text;
create index if not exists idx_expenses_employee on expenses (employee_id) where employee_id is not null;

alter table payroll_deductions add column if not exists expense_id uuid references expenses(id) on delete cascade;
create index if not exists idx_payroll_deductions_expense on payroll_deductions (expense_id) where expense_id is not null;

create or replace function catat_potongan(
  p_employee_id uuid, p_label text, p_amount integer, p_date date, p_category text, p_payment_method text
) returns uuid language plpgsql as $$
declare
  v_name text; v_cat text; v_label text; v_pay text; v_expense uuid; v_deduction uuid;
begin
  select name into v_name from employees where id = p_employee_id;
  if v_name is null then raise exception 'Karyawan tidak ditemukan'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  v_cat := nullif(trim(p_category), '');
  if v_cat is null then raise exception 'Kategori wajib diisi'; end if;
  v_label := coalesce(nullif(trim(p_label), ''), v_cat);
  v_pay := case when p_payment_method = 'Non-Tunai' then 'Non-Tunai' else 'Tunai' end;

  insert into expenses (direction, category, amount, transaction_date, store_or_supplier_name, detail, payment_method, employee_id, employee_name)
  values ('pengeluaran', v_cat, p_amount, p_date, v_name, v_label, v_pay, p_employee_id, v_name)
  returning id into v_expense;

  insert into payroll_deductions (employee_id, label, amount, date, category, expense_id)
  values (p_employee_id, v_label, p_amount, p_date, v_cat, v_expense)
  returning id into v_deduction;

  return v_deduction;
end $$;

grant execute on function catat_potongan(uuid, text, integer, date, text, text) to anon;
grant execute on function catat_potongan(uuid, text, integer, date, text, text) to authenticated;
