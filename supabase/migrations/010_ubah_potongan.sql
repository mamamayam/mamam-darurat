-- =====================================================================
-- Migrasi 010 — Ubah Potongan dari Penggajian (form yang sama dengan Catat Cepat).
-- Jalankan SEKALI di SQL Editor. Aman diulang.
--
-- ubah_potongan(): mengubah potongan gaji DAN pengeluaran karyawan yang terhubung
-- (payroll_deductions.expense_id) dalam SATU transaksi, jadi keduanya selalu sama:
-- nominal, tanggal, kategori, keterangan, dan sumber dana (Tunai/Non-Tunai).
-- Potongan lama tanpa expense_id: hanya potongannya yang berubah.
--
-- Periode gaji yang sudah ditutup tetap menolak lewat trigger lama (migrasi 006).
-- Potongan diubah LEBIH DULU, jadi kalau ditolak, pengeluarannya ikut batal.
-- =====================================================================

create or replace function ubah_potongan(
  p_deduction_id uuid, p_label text, p_amount integer, p_date date, p_category text, p_payment_method text
) returns uuid language plpgsql as $$
declare
  v_cat text; v_label text; v_pay text; v_expense uuid;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  v_cat := nullif(trim(p_category), '');
  if v_cat is null then raise exception 'Kategori wajib diisi'; end if;
  v_label := coalesce(nullif(trim(p_label), ''), v_cat);
  v_pay := case when p_payment_method = 'Non-Tunai' then 'Non-Tunai' else 'Tunai' end;

  select expense_id into v_expense from payroll_deductions where id = p_deduction_id for update;
  if not found then raise exception 'Potongan tidak ditemukan (mungkin sudah dihapus)'; end if;

  update payroll_deductions
     set label = v_label, amount = p_amount, date = p_date, category = v_cat
   where id = p_deduction_id;

  if v_expense is not null then
    update expenses
       set category = v_cat, amount = p_amount, transaction_date = p_date,
           detail = v_label, payment_method = v_pay
     where id = v_expense;
  end if;

  return p_deduction_id;
end $$;

grant execute on function ubah_potongan(uuid, text, integer, date, text, text) to anon;
grant execute on function ubah_potongan(uuid, text, integer, date, text, text) to authenticated;
