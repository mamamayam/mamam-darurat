/**
 * Tes patokan (golden) mesin payroll — port dari
 * mamam-kasir/test/hrd_payroll_engine_test.dart. Angka harapan SAMA persis
 * dengan tes B (yang berasal dari mockup aslinya), jadi tes ini membuktikan
 * hasil C == hasil B, bukan sekadar "terlihat masuk akal".
 * Fixture bulanan dihasilkan otomatis dari hrd_seed_data.dart milik B.
 */
import { describe, it, expect } from 'vitest';
import {
  weekPeriodForDate, shiftWeek, monthPeriod, computeDayResult, computePayroll,
  findStuckBolong, roundedWage, computeAttendance, isOnShiftNow, todayStatus,
} from './payrollEngine.js';
import {
  seedEmployees, seedAttendance, seedAdditions, seedDeductions, seedOpeningBalances, PLACEHOLDER_TODAY,
} from './__fixtures__/hrdSeed.js';

const employeeById = (id) => seedEmployees.find((e) => e.id === id);
const log = (type, time, date = '2026-09-04') => ({ id: 't', employeeId: 'EMP-1001', date, type, time });
const E = employeeById('EMP-1001');          // upah 15000/jam, lembur 5000/30mnt, bonus 25000
const day = (logs, date = '2026-09-04', today = '2026-09-11') => computeDayResult(logs, E, date, today);

describe('weekPeriodForDate (berpatok Jumat)', () => {
  const cases = {
    '2026-09-04': ['2026-09-04', '2026-09-10'],   // Jumat memulai minggunya sendiri
    '2026-09-10': ['2026-09-04', '2026-09-10'],   // Kamis -> minggu yang sama
    '2026-09-11': ['2026-09-11', '2026-09-17'],
    '2026-09-12': ['2026-09-11', '2026-09-17'],
    '2026-09-16': ['2026-09-11', '2026-09-17'],
    '2026-09-17': ['2026-09-11', '2026-09-17'],
    '2026-09-18': ['2026-09-18', '2026-09-24'],
    '2026-08-31': ['2026-08-28', '2026-09-03'],   // melewati batas bulan
  };
  for (const [date, [start, end]] of Object.entries(cases)) {
    it(`${date} -> minggu ${start}..${end}`, () => {
      const w = weekPeriodForDate(date);
      expect(w.start).toBe(start); expect(w.end).toBe(end);
    });
  }
  it('shiftWeek maju/mundur 7 hari', () => {
    const w = weekPeriodForDate('2026-09-11');
    expect(shiftWeek(w, 7)).toMatchObject({ start: '2026-09-18', end: '2026-09-24' });
    expect(shiftWeek(w, -7)).toMatchObject({ start: '2026-09-04', end: '2026-09-10' });
  });
  it('monthPeriod: akhir bulan benar (termasuk Februari kabisat)', () => {
    expect(monthPeriod('2026-09')).toMatchObject({ start: '2026-09-01', end: '2026-09-30', monthKey: '2026-09' });
    expect(monthPeriod('2028-02').end).toBe('2028-02-29');
    expect(monthPeriod('2026-02').end).toBe('2026-02-28');
  });
});

describe('computeDayResult — skenario harian (EMP-1001)', () => {
  it('s01 normal 09:00-19:00', () => {
    const r = day([log('masuk', '09:00'), log('pulang', '19:00')]);
    expect(r).toMatchObject({ status: 'hadir', workedMinutes: 600, overtimeMinutes: 0, bolongMinutes: 0, fullTimeBonus: true, effectiveFromBolong: false });
  });
  it('s02 lembur pagi + sore (08:25-20:15)', () => {
    const r = day([log('masuk', '08:25'), log('pulang', '20:15')]);
    expect(r).toMatchObject({ workedMinutes: 600, overtimeMinutes: 110, fullTimeBonus: true });
  });
  it('s03 telat masuk / pulang awal — tanpa lembur & bonus (09:10-18:30)', () => {
    const r = day([log('masuk', '09:10'), log('pulang', '18:30')]);
    expect(r).toMatchObject({ workedMinutes: 560, overtimeMinutes: 0, fullTimeBonus: false });
  });
  it('s04 pasangan bolong di jam normal mengurangi jam kerja', () => {
    const r = day([log('masuk', '08:55'), log('bolong', '13:00'), log('masuk_lagi', '14:30'), log('pulang', '19:00')]);
    expect(r).toMatchObject({ workedMinutes: 510, bolongMinutes: 90, fullTimeBonus: true });
  });
  it('s05 bolong nyangkut, hari sudah lewat -> dianggap pulang', () => {
    const r = day([log('masuk', '08:55'), log('bolong', '13:00')]);
    expect(r).toMatchObject({ status: 'hadir', workedMinutes: 240, overtimeMinutes: 0, fullTimeBonus: false, effectiveFromBolong: true });
  });
  it('s06 bolong nyangkut di hari yang sama -> perlu klarifikasi, belum dibayar', () => {
    const d = '2026-09-11';
    const r = day([log('masuk', '08:55', d), log('bolong', '13:00', d)], d, d);
    expect(r).toMatchObject({ status: 'perluKlarifikasi', workedMinutes: 0, stuckBolongTime: '13:00' });
  });
  it('s07 bolong nyangkut tapi ada pulang (janggal) -> tetap perlu klarifikasi', () => {
    expect(day([log('masuk', '08:55'), log('bolong', '13:00'), log('pulang', '19:00')]).status).toBe('perluKlarifikasi');
  });
  it('s08 bolong nyangkut, hari lewat, masuk pagi -> lembur pagi tetap, tanpa lembur sore/bonus', () => {
    const r = day([log('masuk', '08:00'), log('bolong', '13:00')]);
    expect(r).toMatchObject({ workedMinutes: 240, overtimeMinutes: 60, fullTimeBonus: false, effectiveFromBolong: true });
  });
  it('s09 libur', () => { expect(day([log('libur', null)]).status).toBe('libur'); });
  it('s10 hanya masuk, belum pulang', () => { expect(day([log('masuk', '09:00')]).status).toBe('belumPulang'); });
  it('s11 lembur besar dua sisi (07:30-21:00)', () => {
    expect(day([log('masuk', '07:30'), log('pulang', '21:00')])).toMatchObject({ workedMinutes: 600, overtimeMinutes: 210, fullTimeBonus: true });
  });
  it('s12 bolong seluruhnya sebelum toko buka -> tidak mengurangi jam kerja', () => {
    const r = day([log('masuk', '08:00'), log('bolong', '08:10'), log('masuk_lagi', '08:20'), log('pulang', '19:00')]);
    expect(r).toMatchObject({ workedMinutes: 600, overtimeMinutes: 60, bolongMinutes: 0 });
  });
  it('s13 bolong melintasi jam buka -> hanya bagian di dalam yang dikurangi', () => {
    const r = day([log('masuk', '08:00'), log('bolong', '08:50'), log('masuk_lagi', '09:20'), log('pulang', '19:00')]);
    expect(r).toMatchObject({ workedMinutes: 580, overtimeMinutes: 60, bolongMinutes: 20 });
  });
  it('s14 ambang pas (masuk 08:30, pulang 19:30) sama-sama dihitung lembur', () => {
    expect(day([log('masuk', '08:30'), log('pulang', '19:30')])).toMatchObject({ workedMinutes: 600, overtimeMinutes: 60, fullTimeBonus: true });
  });
  it('s15 tepat di dalam ambang (08:31 / 19:29) -> tanpa lembur', () => {
    expect(day([log('masuk', '08:31'), log('pulang', '19:29')])).toMatchObject({ workedMinutes: 600, overtimeMinutes: 0, fullTimeBonus: true });
  });
  it('s17 hanya ada bolong tanpa masuk -> belum absen (bukan "nyangkut")', () => {
    expect(day([log('bolong', '13:00')]).status).toBe('belumAbsen');
  });
});

describe('computePayroll — bulanan, 6 karyawan seed (2026-09)', () => {
  const expected = {
    'EMP-1001': { hadir: 9, wage: 1324250, ot: 25000, ft: 175000, net: 1474250 },
    'EMP-1002': { hadir: 8, wage: 1116033, ot: 5000, ft: 120000, net: 1291033 },
    'EMP-1003': { hadir: 6, wage: 1200000, ot: 6000, ft: 180000, net: 1236000 },
    'EMP-1004': { hadir: 2, wage: 208000, ot: 0, ft: 0, net: 208000 },
    'EMP-1005': { hadir: 0, wage: 0, ot: 0, ft: 0, net: 0 },
    'EMP-1006': { hadir: 0, wage: 0, ot: 0, ft: 0, net: 0 },
  };
  const run = (e) => computePayroll({
    employee: e, logs: seedAttendance, additions: seedAdditions, deductions: seedDeductions,
    openingBalances: seedOpeningBalances, period: monthPeriod('2026-09'), today: PLACEHOLDER_TODAY,
  });

  for (const [id, exp] of Object.entries(expected)) {
    it(id, () => {
      const r = run(employeeById(id));
      expect(r.attendance.hadirDays, 'hadirDays').toBe(exp.hadir);
      expect(r.attendance.wagePay, 'wagePay').toBe(exp.wage);
      expect(r.attendance.overtimePay, 'overtimePay').toBe(exp.ot);
      expect(r.attendance.fullTimeBonusPay, 'fullTimeBonusPay').toBe(exp.ft);
      expect(r.netPay, 'netPay').toBe(exp.net);
    });
  }

  it('EMP-1003: saldo awal mengurangi gaji bersih', () => {
    const r = run(employeeById('EMP-1003'));
    expect(r.openingBalance).toBe(-50000);
    expect(r.totalPenghasilan).toBe(1386000);
    expect(r.netPay).toBe(1236000);
  });

  it('total Owner Overview seluruh karyawan', () => {
    let wage = 0, bonus = 0, overtime = 0, deductions = 0;
    for (const e of seedEmployees) {
      const p = run(e);
      wage += p.attendance.wagePay;
      bonus += p.attendance.fullTimeBonusPay + p.additionsTotal;
      overtime += p.attendance.overtimePay;
      deductions += p.deductionsTotal;
    }
    expect(wage).toBe(3848283);
    expect(bonus).toBe(625000);
    expect(overtime).toBe(36000);
    expect(deductions).toBe(350000);
    expect(wage + bonus + overtime).toBe(4509283);
  });
});

describe('bolong nyangkut — transisi status', () => {
  it('pulang tidak boleh berdampingan dengan bolong yang belum selesai', () => {
    expect(findStuckBolong([log('masuk', '09:00'), log('bolong', '12:00')])).not.toBeNull();
  });
  it('masuk_lagi setelah bolong menyelesaikannya', () => {
    expect(findStuckBolong([log('masuk', '09:00'), log('bolong', '12:00'), log('masuk_lagi', '13:00')])).toBeNull();
  });
  it('bolong kedua setelah masuk_lagi bisa nyangkut sendiri', () => {
    const s = findStuckBolong([log('masuk', '09:00'), log('bolong', '12:00'), log('masuk_lagi', '13:00'), log('bolong', '16:00')]);
    expect(s.time).toBe('16:00');
  });
});

describe('roundedWage & tambahan', () => {
  it('pembulatan setengah naik dengan bilangan bulat', () => {
    expect(roundedWage(90, 15000)).toBe(22500);
    expect(roundedWage(1, 15000)).toBe(250);
    expect(roundedWage(599, 15000)).toBe(149750);
  });
  it('lembur dibulatkan ke bawah pada TOTAL periode, bukan per hari', () => {
    // 3 hari x 20 menit lembur: per hari 0 blok, tapi total 60 menit = 2 blok
    const logs = ['2026-09-01', '2026-09-02', '2026-09-03'].flatMap((d) => [
      { id: d + 'a', employeeId: 'EMP-1001', date: d, type: 'masuk', time: '08:40' },      // masuk 08:40 -> tidak lembur pagi
      { id: d + 'b', employeeId: 'EMP-1001', date: d, type: 'pulang', time: '19:30' },     // pulang 19:30 -> 30 menit lembur
    ]);
    const a = computeAttendance(E, logs, monthPeriod('2026-09'), '2026-09-30');
    expect(a.totalOvertimeMinutes).toBe(90);
    expect(a.overtimeBlocks30Min).toBe(3);
  });
  it('tarif lembur 0/kosong memakai bawaan 5.000', () => {
    const a = computeAttendance({ ...E, overtimeRatePer30Min: 0 }, [
      { id: 'x', employeeId: 'EMP-1001', date: '2026-09-01', type: 'masuk', time: '09:00' },
      { id: 'y', employeeId: 'EMP-1001', date: '2026-09-01', type: 'pulang', time: '20:00' },
    ], monthPeriod('2026-09'), '2026-09-30');
    expect(a.overtimeRate).toBe(5000);
    expect(a.overtimePay).toBe(2 * 5000);
  });
  it('saldo awal HANYA berlaku untuk periode bulanan, bukan mingguan', () => {
    const args = { employee: employeeById('EMP-1003'), logs: seedAttendance, additions: [], deductions: [], openingBalances: seedOpeningBalances, today: PLACEHOLDER_TODAY };
    expect(computePayroll({ ...args, period: monthPeriod('2026-09') }).openingBalance).toBe(-50000);
    expect(computePayroll({ ...args, period: weekPeriodForDate('2026-09-04') }).openingBalance).toBe(0);
  });
  it('log karyawan lain / di luar periode tidak ikut terhitung', () => {
    const a = computeAttendance(E, seedAttendance, weekPeriodForDate('2026-09-04'), PLACEHOLDER_TODAY);
    expect(a.dayRows.every((r) => r.date >= '2026-09-04' && r.date <= '2026-09-10')).toBe(true);
  });
  it('status hari ini & sedang jaga', () => {
    expect(isOnShiftNow([log('masuk', '09:00')])).toBe(true);
    expect(isOnShiftNow([log('masuk', '09:00'), log('bolong', '12:00')])).toBe(false);
    expect(isOnShiftNow([log('masuk', '09:00'), log('pulang', '19:00')])).toBe(false);
    expect(todayStatus([], E, '2026-09-11')).toBe('belumAbsen');
  });
});
