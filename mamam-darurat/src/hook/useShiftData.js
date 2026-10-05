import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { computeShiftStats, computeDifference, shiftCodeFromId } from '../features/shift/shiftMath';

/**
 * useShiftData — layer data Shift/Dompet, ONLINE-FIRST.
 *
 * Sumber kebenaran = tabel `shifts` di Supabase. "Shift aktif" = baris
 * dengan closed_at IS NULL. Database menjamin hanya boleh ada SATU
 * (unique index uq_one_open_shift), jadi dua HP yang sama-sama buka dompet
 * tidak bisa menghasilkan dua shift aktif — yang kedua ditolak dengan pesan
 * jelas, bukan diam-diam menimpa.
 *
 * Angka uang dihitung oleh shiftMath.js (fungsi murni, sudah dites) dari
 * data mentah transaksi/pengeluaran pada rentang shift.
 */

const fail = (error, aksi) => { throw new Error(`${aksi}: ${error.message}`); };

// Data mentah untuk sebuah rentang waktu [from, to]
const toISO = (v) => (v instanceof Date ? v : new Date(v)).toISOString();

async function fetchRaw(fromRaw, toRaw) {
  // Terima string ATAU Date, selalu diolah sebagai ISO string.
  const fromISO = toISO(fromRaw);
  const toISOStr = toRaw ? toISO(toRaw) : null;
  // Penjualan: pakai paid_at (waktu presisi). Pengeluaran: pakai created_at
  // (waktu presisi dicatat), BUKAN transaction_date — kolom itu hanya
  // TANGGAL tanpa jam, sehingga pengeluaran yang dicatat pagi hari (sebelum
  // shift dibuka) ikut terhitung ke shift baru di hari yang sama. Ini bug
  // yang sama dengan yang pernah terjadi di mamam-global.
  let salesQ = supabase.from('transactions')
    .select('id, total, payment_method, split_payments_json, cash_holder_employee_id, cash_holder_name, created_at')
    .eq('status', 'paid').gte('paid_at', fromISO);
  if (toISOStr) salesQ = salesQ.lte('paid_at', toISOStr);
  let expQ = supabase.from('expenses')
    .select('id, direction, amount, payment_method, cash_holder_employee_id, cash_holder_name, created_at')
    .gte('created_at', fromISO);
  if (toISOStr) expQ = expQ.lte('created_at', toISOStr);
  const [sales, exp] = await Promise.all([salesQ, expQ]);
  if (sales.error) fail(sales.error, 'Gagal memuat penjualan');
  if (exp.error) fail(exp.error, 'Gagal memuat pengeluaran');
  return {
    sales: sales.data || [],
    expenses: (exp.data || []).filter(e => e.direction === 'pengeluaran'),
    incomes: (exp.data || []).filter(e => e.direction === 'pemasukan'),
  };
}

export function useShiftData() {
  const [currentShift, setCurrentShift] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [open, hist, emps] = await Promise.all([
        supabase.from('shifts').select('*').is('closed_at', null).order('opened_at', { ascending: false }),
        supabase.from('shifts').select('*').not('closed_at', 'is', null).order('closed_at', { ascending: false }),
        supabase.from('employees').select('id, name, role, status').order('name'),
      ]);
      const bad = [open, hist, emps].find(r => r.error);
      if (bad) throw new Error(bad.error.message);

      const shift = (open.data || [])[0] || null;
      setCurrentShift(shift ? { ...shift, code: shift.code || shiftCodeFromId(shift.id) } : null);
      setHistory((hist.data || []).map(s => ({ ...s, code: s.code || shiftCodeFromId(s.id) })));
      setEmployees(emps.data || []);

      if (shift) {
        const raw = await fetchRaw(shift.opened_at, null);
        setStats(computeShiftStats({ shift, ...raw }));
      } else {
        setStats(null);
      }
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── BUKA DOMPET ──────────────────────────────────────────────────────
  const openShift = async ({ initialCash, openedByEmployeeId }) => {
    const opening = Number(initialCash);
    if (!Number.isFinite(opening) || opening < 0) throw new Error('Masukkan nominal saldo awal yang valid.');
    const emp = employees.find(e => e.id === openedByEmployeeId);
    const { data, error: e } = await supabase.from('shifts').insert({
      opening_balance: opening,
      opened_by_employee_id: emp?.id || null,
      opened_by_employee_name: emp?.name || null,
    }).select('id').single();
    if (e) {
      // 23505 = unique_violation: sudah ada shift terbuka (mis. dibuka dari HP lain)
      if (e.code === '23505' || /uq_one_open_shift|duplicate key/i.test(e.message)) {
        await reload();
        throw new Error('Dompet sudah dibuka dari perangkat lain. Tampilan sudah diperbarui.');
      }
      fail(e, 'Gagal membuka dompet');
    }
    // code dibuat dari id supaya unik & stabil
    await supabase.from('shifts').update({ code: shiftCodeFromId(data.id) }).eq('id', data.id);
    await reload();
  };

  // ── TUTUP DOMPET ─────────────────────────────────────────────────────
  // Menghitung ULANG dari data terbaru (bukan memakai angka di layar yang
  // mungkin basi), lalu membekukan hasilnya di baris shift.
  const closeShift = async ({ actualCash }) => {
    const actual = Number(actualCash);
    if (!Number.isFinite(actual) || actual < 0) throw new Error('Masukkan uang aktual yang ada di dompet.');
    if (!currentShift) throw new Error('Tidak ada dompet yang sedang terbuka.');

    const closedAt = new Date().toISOString();
    const raw = await fetchRaw(currentShift.opened_at, closedAt);
    const fresh = computeShiftStats({ shift: currentShift, ...raw });
    const difference = computeDifference(actual, fresh.expectedCash);

    // .is('closed_at', null) = hanya menutup kalau MASIH terbuka. Kalau HP lain
    // sudah menutupnya duluan, update ini tidak mengenai baris apa pun.
    const { data, error: e } = await supabase.from('shifts').update({
      closed_at: closedAt,
      closing_balance: actual,
      expected_cash: fresh.expectedCash,
      difference,
      stats_json: fresh,
      courier_snapshot_json: fresh.couriers,
    }).eq('id', currentShift.id).is('closed_at', null).select('id');
    if (e) fail(e, 'Gagal menutup dompet');
    if (!data || data.length === 0) {
      await reload();
      throw new Error('Dompet ini sudah ditutup dari perangkat lain. Tampilan sudah diperbarui.');
    }
    const closed = { ...currentShift, closed_at: closedAt, closing_balance: actual, expected_cash: fresh.expectedCash, difference, stats_json: fresh, courier_snapshot_json: fresh.couriers };
    await reload();
    return closed;   // untuk layar ringkasan tutup
  };

  return { currentShift, stats, history, employees, loading, error, reload, openShift, closeShift };
}
