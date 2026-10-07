import { describe, it, expect } from 'vitest';
import { employeeGrossCost, isKasbon } from './payrollCost.js';

const r = (wage, ft, ot, add, deds) => ({ payroll: { attendance: { wagePay: wage, fullTimeBonusPay: ft, overtimePay: ot }, additionsTotal: add, deductions: deds } });

describe('employeeGrossCost (upah kotor; kasbon bukan upah)', () => {
  it('upah + FT + lembur + tambahan', () => { expect(employeeGrossCost(r(1000000, 100000, 50000, 25000, [])).gross).toBe(1175000); });
  it('potongan Kasbon TIDAK mengurangi upah kotor, potongan lain mengurangi', () => {
    const x = employeeGrossCost(r(1000000, 0, 0, 0, [{ category: 'Kasbon', amount: 200000 }, { category: 'Denda', amount: 30000 }]));
    expect(x.gross).toBe(970000); expect(x.kasbon).toBe(200000);
  });
  it('isKasbon mengenali "Kasbon" dan "Kasbon Karyawan"', () => {
    expect(isKasbon('Kasbon')).toBe(true); expect(isKasbon('kasbon karyawan')).toBe(true); expect(isKasbon('Denda')).toBe(false);
  });
});
