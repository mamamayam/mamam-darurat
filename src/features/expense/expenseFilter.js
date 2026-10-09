import { periodRange } from '../reports/reportsMath';

/**
 * expenseFilter — saring daftar Pengeluaran (periode, kategori, sumber, pencarian).
 * FUNGSI MURNI (dites di expenseFilter.test.js).
 *
 * Tanggal pengeluaran = string "YYYY-MM-DD" apa adanya (TIDAK di-parse sebagai Date UTC).
 * Sumber: pengeluaran karyawan (potongan dari Catat Cepat, employeeId terisi) = "Karyawan"; sisanya "Toko".
 */

export const dayOf = (v) => String(v).slice(0, 10);
export const sourceOf = (e) => (e.employeeId ? 'Karyawan' : 'Toko');

export const SORT_OPTIONS = [
  { key: 'date-desc', label: 'Terbaru Dulu', short: 'Terbaru' },
  { key: 'date-asc', label: 'Terlama Dulu', short: 'Terlama' },
  { key: 'category-asc', label: 'Kategori (A-Z)', short: 'Kategori A-Z' },
  { key: 'category-desc', label: 'Kategori (Z-A)', short: 'Kategori Z-A' },
  { key: 'amount-desc', label: 'Nominal Terbesar', short: 'Terbesar' },
];
export const DEFAULT_SORT = 'date-desc';
/** Urutan yang mengikuti tanggal -> daftar boleh dikelompokkan per hari. */
export const isDateSort = (key) => key === 'date-desc' || key === 'date-asc';

/** Masuk periode? `semua` = ya; `tanggal-terpilih` tanpa tanggal awal = ya (semua). */
export function inPeriod(date, mode, custom = {}, today) {
  const { fromDate, toDate } = periodRange(mode, custom, today);
  if (!fromDate && !toDate) return true;
  const d = dayOf(date);
  return d >= fromDate && d <= toDate;
}

/** Hanya periode (belum kategori/sumber/pencarian) — dasar daftar kategori. */
export const filterByPeriod = (expenses, mode, custom, today) =>
  expenses.filter((e) => inPeriod(e.date, mode, custom, today));

/** Kategori + pencarian (belum sumber). Cari: kategori, toko/supplier, catatan, pemegang kas, nama karyawan. */
export function filterExpenses(expenses, { category = 'semua', query = '', employeeName = () => '' } = {}) {
  const q = String(query).trim().toLowerCase();
  return expenses.filter((e) => {
    if (category !== 'semua' && e.category !== category) return false;
    if (!q) return true;
    return [e.category, e.supplier, e.note, e.cashHolderName, employeeName(e)]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });
}

/** Ringkasan per sumber (hanya yang ada isinya). -> [{ key:'Toko'|'Karyawan', count, total }] */
export function sourceStats(expenses) {
  const stat = { Toko: { key: 'Toko', count: 0, total: 0 }, Karyawan: { key: 'Karyawan', count: 0, total: 0 } };
  for (const e of expenses) {
    const s = stat[sourceOf(e)];
    s.count += 1; s.total += Number(e.amount) || 0;
  }
  return [stat.Toko, stat.Karyawan].filter((s) => s.count > 0);
}
