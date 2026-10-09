import { describe, it, expect } from 'vitest';
import { inPeriod, filterByPeriod, filterExpenses, sourceStats, sourceOf, isDateSort } from './expenseFilter';

const TODAY = '2026-10-10';
const E = [
  { id: 1, date: '2026-10-10', category: 'Belanja Bahan', supplier: 'Pasar Cihapit', note: 'Cabai\nBawang', amount: 100000, employeeId: null },
  { id: 2, date: '2026-10-09', category: 'Bayar Ayam', supplier: 'Pak Ujang', note: 'Ayam 40 ekor', amount: 900000, employeeId: null },
  { id: 3, date: '2026-10-02', category: 'Kasbon', supplier: '', note: '', amount: 200000, employeeId: 'emp-1' },
  { id: 4, date: '2026-09-30', category: 'Gas', supplier: 'Agen Titin', note: 'Gas 12 kg', amount: 150000, employeeId: null, cashHolderName: 'Bu Wati' },
];

describe('expenseFilter', () => {
  it('inPeriod: hari ini, kemarin, bulan ini, semua, rentang', () => {
    expect(inPeriod('2026-10-10', 'hari-ini', {}, TODAY)).toBe(true);
    expect(inPeriod('2026-10-09', 'hari-ini', {}, TODAY)).toBe(false);
    expect(inPeriod('2026-10-09', 'kemarin', {}, TODAY)).toBe(true);
    expect(inPeriod('2026-10-02', 'bulan-ini', {}, TODAY)).toBe(true);
    expect(inPeriod('2026-09-30', 'bulan-ini', {}, TODAY)).toBe(false);
    expect(inPeriod('2020-01-01', 'semua', {}, TODAY)).toBe(true);
    expect(inPeriod('2026-10-05', 'tanggal-terpilih', { start: '2026-10-01', end: '2026-10-09' }, TODAY)).toBe(true);
    expect(inPeriod('2026-10-10', 'tanggal-terpilih', { start: '2026-10-01', end: '2026-10-09' }, TODAY)).toBe(false);
  });

  it('inPeriod: tanggal-terpilih tanpa akhir = satu hari; tanpa awal = semua', () => {
    expect(inPeriod('2026-10-02', 'tanggal-terpilih', { start: '2026-10-02' }, TODAY)).toBe(true);
    expect(inPeriod('2026-10-03', 'tanggal-terpilih', { start: '2026-10-02' }, TODAY)).toBe(false);
    expect(inPeriod('2026-01-01', 'tanggal-terpilih', {}, TODAY)).toBe(true);
  });

  it('inPeriod: tanggal bertimestamp tetap dibaca per hari', () => {
    expect(inPeriod('2026-10-10T23:30:00', 'hari-ini', {}, TODAY)).toBe(true);
  });

  it('filterByPeriod', () => {
    expect(filterByPeriod(E, 'bulan-ini', {}, TODAY).map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('filterExpenses: kategori dan pencarian di banyak kolom', () => {
    expect(filterExpenses(E, { category: 'Bayar Ayam' }).map((e) => e.id)).toEqual([2]);
    expect(filterExpenses(E, { query: 'cabai' }).map((e) => e.id)).toEqual([1]);
    expect(filterExpenses(E, { query: 'ujang' }).map((e) => e.id)).toEqual([2]);
    expect(filterExpenses(E, { query: 'wati' }).map((e) => e.id)).toEqual([4]);
    expect(filterExpenses(E, { query: 'agus', employeeName: (e) => (e.employeeId ? 'Agus' : '') }).map((e) => e.id)).toEqual([3]);
    expect(filterExpenses(E, { category: 'Gas', query: 'gas 12' }).map((e) => e.id)).toEqual([4]);
    expect(filterExpenses(E, { query: 'tidak ada' })).toEqual([]);
  });

  it('sourceStats memisahkan Toko dan Karyawan dan membuang yang kosong', () => {
    expect(sourceOf(E[2])).toBe('Karyawan');
    expect(sourceStats(E)).toEqual([
      { key: 'Toko', count: 3, total: 1150000 },
      { key: 'Karyawan', count: 1, total: 200000 },
    ]);
    expect(sourceStats([E[0]])).toEqual([{ key: 'Toko', count: 1, total: 100000 }]);
  });

  it('isDateSort', () => {
    expect(isDateSort('date-desc')).toBe(true);
    expect(isDateSort('amount-desc')).toBe(false);
  });
});
