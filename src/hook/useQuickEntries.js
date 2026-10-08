import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toLocalDateString } from '../utils/formatters';
import {
  newAdditionRow, deductionRpcArgs, summarizeTodayExpenses, buildFeed, pendingRequests, startOfLocalDayISO,
  mapAdditionRow, mapDeductionRow, mapExpenseRow,
} from '../features/home/quickEntryMath';
import { setPendingApprovals } from './usePendingApprovals';

/**
 * useQuickEntries — data "Catat Cepat" di Beranda, ONLINE-FIRST.
 *
 *  - Tambah (payroll_additions): staf mengajukan ('menunggu'), owner menyetujui/menolak.
 *  - Potongan: RPC catat_potongan = potongan gaji + pengeluaran karyawan dalam SATU
 *    transaksi (tunai otomatis mengurangi saldo Dompet).
 *  - Pengeluaran toko: disimpan form Pengeluaran biasa (ExpenseFormSheet); di sini hanya dibaca.
 *
 * Kalau migrasi 009 belum dijalankan, Beranda tetap tampil (kolom baru dianggap kosong),
 * dan menyimpan memberi pesan jelas untuk menjalankan migrasinya.
 */

const MIGRATION_HINT = 'Fitur ini butuh migrasi baru: jalankan supabase/migrations/009_catat_cepat.sql di SQL Editor dulu.';
const fail = (error, aksi) => {
  // PGRST204 = kolom tidak ada, PGRST202 = fungsi tidak ada (schema cache), 42703/42883 = kolom/fungsi tidak ada (Postgres)
  if (['PGRST204', 'PGRST202', '42703', '42883'].includes(error.code) || /schema cache|does not exist/i.test(error.message || '')) throw new Error(MIGRATION_HINT);
  throw new Error(`${aksi}: ${error.message}`);
};

const EXPENSE_COLUMNS = 'id, category, amount, transaction_date, store_or_supplier_name, detail, payment_method, created_at';

export function useQuickEntries({ canApprove, onChanged }) {
  const [employees, setEmployees] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [pending, setPending] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [today, setToday] = useState(toLocalDateString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const onChangedRef = useRef(onChanged);
  useEffect(() => { onChangedRef.current = onChanged; });   // selalu pakai callback terbaru tanpa memicu reload
  const lastRequester = useRef('');   // "Dicatat oleh" terakhir dipakai, supaya staf tidak memilih ulang tiap kali

  const reload = useCallback(async () => {
    try {
      const day = toLocalDateString();
      const since = startOfLocalDayISO(day);
      const inToday = (col) => `${col}.eq.${day},created_at.gte.${since}`;   // dicatat untuk hari ini ATAU dibuat hari ini

      const fetchExpenses = async () => {
        const base = (cols) => supabase.from('expenses').select(cols).eq('direction', 'pengeluaran').or(inToday('transaction_date')).order('created_at', { ascending: false });
        const first = await base(`${EXPENSE_COLUMNS}, employee_id`);
        if (!first.error) return first;
        return base(EXPENSE_COLUMNS);   // migrasi 009 belum ada: semua dianggap pengeluaran toko
      };

      const [emps, adds, deds, exps, pend] = await Promise.all([
        supabase.from('employees').select('id, name, role, status').order('name'),
        supabase.from('payroll_additions').select('*').or(inToday('date')).order('created_at', { ascending: false }),
        supabase.from('payroll_deductions').select('*').or(inToday('date')).order('created_at', { ascending: false }),
        fetchExpenses(),
        canApprove ? supabase.from('payroll_additions').select('*').eq('status', 'menunggu').order('created_at') : Promise.resolve({ data: [], error: null }),
      ]);
      const bad = [emps, adds, deds, exps].find(r => r.error);
      if (bad) throw new Error(bad.error.message);

      const nameById = Object.fromEntries((emps.data || []).map(e => [e.id, e.name]));
      setEmployees((emps.data || []).filter(e => e.status !== 'resign'));
      setAdditions((adds.data || []).map(r => mapAdditionRow(r, nameById)));
      setDeductions((deds.data || []).map(r => mapDeductionRow(r, nameById)));
      setExpenses((exps.data || []).map(mapExpenseRow));
      const pendingRows = pend.error ? [] : (pend.data || []).map(r => mapAdditionRow(r, nameById));   // kolom status belum ada = tidak ada pengajuan
      setPending(pendingRows);
      setPendingApprovals(canApprove ? pendingRows.length : 0);
      setToday(day);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [canApprove]);

  useEffect(() => { reload(); }, [reload]);

  // Owner perlu melihat pengajuan baru tanpa refresh: muat ulang saat aplikasi dibuka kembali + tiap 60 detik.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') reload(); };
    const timer = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [reload]);

  /** Tambah: owner langsung disetujui, staf menunggu persetujuan. Mengembalikan 'disetujui' | 'menunggu'. */
  const submitAddition = async (form) => {
    const row = newAdditionRow(form, { canApprove, nowISO: new Date().toISOString() });
    const { error: e } = await supabase.from('payroll_additions').insert(row);
    if (e) fail(e, 'Gagal menyimpan tambahan');
    if (!canApprove) lastRequester.current = form.requestedBy;
    await reload();
    onChangedRef.current?.();
    return row.status;
  };

  /** Potongan: langsung dicatat + jadi pengeluaran karyawan (tunai = mengurangi Dompet). */
  const submitDeduction = async (form) => {
    const { error: e } = await supabase.rpc('catat_potongan', deductionRpcArgs(form));
    if (e) fail(e, 'Gagal menyimpan potongan');
    await reload();
    onChangedRef.current?.();   // potongan = pengeluaran karyawan: kartu di Beranda ikut berubah
  };

  /** Owner: setujui / tolak pengajuan. Menolak 'sudah diputuskan di perangkat lain' dengan jelas. */
  const decide = async (id, approve, reason = '') => {
    const patch = approve
      ? { status: 'disetujui', approved_by: 'Owner', approved_at: new Date().toISOString(), reject_reason: null }
      : { status: 'ditolak', reject_reason: reason.trim() || null, approved_by: null, approved_at: null };
    const { data, error: e } = await supabase.from('payroll_additions').update(patch).eq('id', id).eq('status', 'menunggu').select('id');
    if (e) fail(e, approve ? 'Gagal menyetujui' : 'Gagal menolak');
    if (!data || data.length === 0) { await reload(); throw new Error('Pengajuan ini sudah diputuskan sebelumnya. Tampilan sudah diperbarui.'); }
    await reload();
    onChangedRef.current?.();
  };

  /** Staf membatalkan pengajuan yang masih menunggu. */
  const cancelRequest = async (id) => {
    const { error: e } = await supabase.from('payroll_additions').delete().eq('id', id).eq('status', 'menunggu');
    if (e) fail(e, 'Gagal membatalkan pengajuan');
    await reload();
    onChangedRef.current?.();
  };

  /** Setelah form Pengeluaran biasa menyimpan. */
  const afterExpenseSaved = async () => { await reload(); onChangedRef.current?.(); };

  const totals = useMemo(() => summarizeTodayExpenses(expenses, today), [expenses, today]);
  const feed = useMemo(() => buildFeed({ additions, deductions, expenses }), [additions, deductions, expenses]);
  const pendingList = useMemo(() => pendingRequests(pending), [pending]);

  return {
    employees, pending: pendingList, feed, totals, today, loading, error, reload,
    submitAddition, submitDeduction, decide, cancelRequest, afterExpenseSaved, lastRequester,
  };
}
