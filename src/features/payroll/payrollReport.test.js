import { describe, it, expect } from 'vitest';
import { buildPayrollReport, itemTitle, dayDetail, isKasbon, fmtDay, fmtHM } from './payrollReport.js';
import { computePayroll, monthPeriod } from './payrollEngine.js';
import { seedEmployees, seedAttendance, seedAdditions, seedDeductions, seedOpeningBalances, PLACEHOLDER_TODAY } from './__fixtures__/hrdSeed.js';

const rp = (n) => `Rp ${n}`;
const attendance = (over = {}) => ({
  dayRows: [], hadirDays: 0, liburDays: 0, fullTimeDays: 0, totalWorkedMinutes: 0, totalOvertimeMinutes: 0, overtimeBlocks30Min: 0, overtimeRate: 5000,
  wagePay: 0, overtimePay: 0, fullTimeBonusPay: 0, ...over,
});
const payroll = (over = {}) => ({
  attendance: attendance(), additions: [], deductions: [], additionsTotal: 0, deductionsTotal: 0, openingBalance: 0, totalPenghasilan: 0, netPay: 0, ...over,
});

describe('format kecil', () => {
  it('fmtDay / fmtHM / isKasbon', () => {
    expect(fmtDay('2026-10-07')).toBe('7 Okt');
    expect(fmtHM(540)).toBe('9j 00m');
    expect(fmtHM(95)).toBe('1j 35m');
    expect(isKasbon({ category: ' kasbon ' })).toBe(true);
    expect(isKasbon({ category: 'Denda' })).toBe(false);
  });
  it('itemTitle: kategori saja kalau keterangan kosong atau sama', () => {
    expect(itemTitle({ category: 'Kasbon', label: '' })).toBe('Kasbon');
    expect(itemTitle({ category: 'Kasbon', label: 'Kasbon' })).toBe('Kasbon');
    expect(itemTitle({ category: 'Denda', label: 'Piring pecah' })).toBe('Denda · Piring pecah');
  });
  it('dayDetail: hanya hari hadir; lembur/bolong/FT ditempel', () => {
    expect(dayDetail({ status: 'libur' })).toBe('');
    expect(dayDetail(null)).toBe('');
    expect(dayDetail({ status: 'hadir', workedMinutes: 540, overtimeMinutes: 0, bolongMinutes: 0, fullTimeBonus: false })).toBe('9j 00m');
    expect(dayDetail({ status: 'hadir', workedMinutes: 600, overtimeMinutes: 30, bolongMinutes: 15, fullTimeBonus: true })).toBe('10j 00m · lembur 30m · bolong 15m · FT');
  });
});

describe('buildPayrollReport', () => {
  it('kasbon dipisah dari potongan lain; saldo awal ikut Pengurangan', () => {
    const r = buildPayrollReport(payroll({
      attendance: attendance({ wagePay: 135000, totalWorkedMinutes: 540 }),
      deductions: [{ id: 'a', category: 'Kasbon', amount: 20000, date: '2026-10-08' }, { id: 'b', category: 'Denda', amount: 5000, date: '2026-10-07' }],
      deductionsTotal: 25000, openingBalance: 10000, totalPenghasilan: 135000, netPay: 100000,
    }), { formatRupiah: rp });
    expect(r.cuts.map((c) => [c.key, c.amount])).toEqual([['kasbon', 20000], ['potongan', 5000], ['saldo', 10000]]);
    expect(r.totalDeductions).toBe(35000);
    expect(r.totalIncome - r.totalDeductions).toBe(r.net);
    expect(r.income[0].label).toBe('Upah (9j 00m)');
    expect(r.income[1].label).toBe('Lembur (0 mnt → 0 blok × Rp 5000)');
  });

  it('mingguan (withOpening: false): tanpa baris Saldo awal, angka tetap cocok', () => {
    const p = payroll({
      attendance: attendance({ wagePay: 100000 }), deductions: [{ id: 'a', category: 'Kasbon', amount: 20000, date: '2026-10-08' }],
      deductionsTotal: 20000, totalPenghasilan: 100000, netPay: 80000,
    });
    const r = buildPayrollReport(p, { formatRupiah: rp, withOpening: false });
    expect(r.cuts.map((c) => c.key)).toEqual(['kasbon', 'potongan']);
    expect(r.totalDeductions).toBe(20000);
    expect(r.totalIncome - r.totalDeductions).toBe(r.net);
    expect(buildPayrollReport(p, { formatRupiah: rp }).cuts.map((c) => c.key)).toEqual(['kasbon', 'potongan', 'saldo']);
  });

  it('saldo awal negatif (toko berutang) menambah gaji', () => {
    const r = buildPayrollReport(payroll({ totalPenghasilan: 100000, openingBalance: -15000, netPay: 115000 }), { formatRupiah: rp });
    expect(r.totalDeductions).toBe(-15000);
    expect(r.totalIncome - r.totalDeductions).toBe(r.net);
  });

  it('catatan ditaruh di tanggalnya; tanggal tanpa absensi tetap muncul; urut tanggal', () => {
    const r = buildPayrollReport(payroll({
      attendance: attendance({ dayRows: [{ date: '2026-10-07', status: 'hadir' }, { date: '2026-10-09', status: 'libur' }] }),
      deductions: [{ id: 'k', category: 'Kasbon', label: '', amount: 20000, date: '2026-10-08', expenseId: 'x1', employeeId: 'e1' }],
      additions: [{ id: 't', category: 'Bonus', label: 'THR', amount: 50000, date: '2026-10-07' }],
      deductionsTotal: 20000, additionsTotal: 50000,
    }), { formatRupiah: rp });
    expect(r.days.map((d) => d.date)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09']);
    expect(r.days[0].items.map((i) => [i.kind, i.id])).toEqual([['tambahan', 't']]);
    expect(r.days[1].row).toBeNull();
    expect(r.days[1].items[0]).toMatchObject({ kind: 'potongan', id: 'k', expenseId: 'x1', employeeId: 'e1', date: '2026-10-08' });
    expect(r.days[2].items).toEqual([]);
  });

  it('angka laporan = angka engine untuk SEMUA karyawan di data seed (tidak ada hitungan baru)', () => {
    const period = monthPeriod('2026-09');
    for (const e of seedEmployees) {
      const p = computePayroll({ employee: e, logs: seedAttendance, additions: seedAdditions, deductions: seedDeductions, openingBalances: seedOpeningBalances, period, today: PLACEHOLDER_TODAY });
      const r = buildPayrollReport(p, { formatRupiah: rp });
      expect(r.net).toBe(p.netPay);
      expect(r.totalIncome).toBe(p.totalPenghasilan);
      expect(r.totalIncome - r.totalDeductions).toBe(p.netPay);
      expect(r.days.reduce((n, d) => n + d.items.filter((i) => i.kind === 'potongan').length, 0)).toBe(p.deductions.length);
      expect(r.days.reduce((n, d) => n + d.items.filter((i) => i.kind === 'tambahan').length, 0)).toBe(p.additions.length);
    }
  });
});
