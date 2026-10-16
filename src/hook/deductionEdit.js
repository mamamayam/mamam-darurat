import { supabase } from '../lib/supabase';
import { deductionUpdateArgs } from '../features/home/quickEntryMath';

/**
 * deductionEdit — mengubah Potongan (= pengeluaran karyawan) dari mana pun: Beranda, Pengeluaran, Penggajian.
 * Satu jalur: RPC ubah_potongan (migrasi 010) mengubah potongan gaji DAN pengeluaran karyawannya dalam
 * SATU transaksi, jadi keduanya tidak pernah beda. Periode gaji yang sudah ditutup ditolak oleh database.
 */
const MIGRATION_010 = 'Mengubah potongan butuh migrasi baru: jalankan supabase/migrations/010_ubah_potongan.sql di SQL Editor dulu.';

export async function updateDeduction(id, form) {
  const { error } = await supabase.rpc('ubah_potongan', deductionUpdateArgs(id, form));
  if (!error) return;
  if (['PGRST202', '42883'].includes(error.code) || /schema cache|does not exist/i.test(error.message || '')) throw new Error(MIGRATION_010);
  throw new Error(`Gagal mengubah potongan: ${error.message}`);
}

/** Potongan yang tertaut ke satu pengeluaran karyawan (payroll_deductions.expense_id); null kalau tidak ada. */
export async function fetchDeductionByExpense(expenseId) {
  const { data, error } = await supabase.from('payroll_deductions').select('id, employee_id, label, category, amount, date').eq('expense_id', expenseId).maybeSingle();
  if (error) throw new Error(`Gagal membaca potongan: ${error.message}`);
  return data ? { id: data.id, employeeId: data.employee_id, label: data.label || '', category: data.category, amount: data.amount, date: String(data.date).slice(0, 10) } : null;
}

/** Sumber dana pengeluaran yang tertaut ke potongan; null kalau pengeluarannya tidak ditemukan. */
export async function fetchExpensePayment(expenseId) {
  const { data, error } = await supabase.from('expenses').select('payment_method').eq('id', expenseId).maybeSingle();
  if (error) throw new Error(`Gagal membaca sumber dana potongan: ${error.message}`);
  if (!data) return null;
  return data.payment_method === 'Non-Tunai' ? 'Non-Tunai' : 'Tunai';
}
