import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import PayrollReport from './PayrollReport.jsx';
import { buildPayrollReport } from './payrollReport.js';

const formatRupiah = (n) => `Rp ${(n || 0).toLocaleString('id-ID')}`;
const payroll = {
  attendance: {
    dayRows: [{ date: '2026-10-07', status: 'hadir', workedMinutes: 540, overtimeMinutes: 0, bolongMinutes: 0, fullTimeBonus: false }],
    hadirDays: 1, liburDays: 8, fullTimeDays: 0, totalWorkedMinutes: 540, totalOvertimeMinutes: 0, overtimeBlocks30Min: 0, overtimeRate: 5000,
    wagePay: 135000, overtimePay: 0, fullTimeBonusPay: 0,
  },
  additions: [], deductions: [{ id: 'k', employeeId: 'e1', category: 'Kasbon', label: '', amount: 20000, date: '2026-10-08', expenseId: 'x' }],
  additionsTotal: 0, deductionsTotal: 20000, openingBalance: 0, totalPenghasilan: 135000, netPay: 115000,
};
const render = (over = {}) => renderToString(
  <PayrollReport report={buildPayrollReport(payroll, { formatRupiah })} isLocked={false} formatRupiah={formatRupiah} dayFlags={() => ({})}
    onEditDay={() => {}} onEditDeduction={() => {}} onDeleteItem={() => {}} canEditOpening openingInput="" onOpeningChange={() => {}} onSaveOpening={() => {}}
    busy={false} onShare={() => {}} {...over} />,
);

describe('PayrollReport (render awal)', () => {
  it('ringkas: Gaji Bersih + 3 bagian tertutup, rincian belum dimuat; ada tombol Bagikan PDF', () => {
    const html = render();
    expect(html).toContain('Gaji Bersih');
    expect(html).toContain('Rp 115.000');
    for (const t of ['Total Pendapatan', 'Pengurangan', 'Rincian Harian', 'Bagikan PDF']) expect(html).toContain(t);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
    expect(html).not.toContain('Saldo Awal Bulan');   // form saldo awal ada di dalam Pengurangan (tertutup)
    expect(html).not.toContain('Upah (9j 00m)');      // isi Total Pendapatan belum dibuka
  });

  it('pengurangan tampil negatif dan merah', () => {
    const html = render();
    expect(html).toContain('text-red-500');
    expect(html).toContain('Rp -20.000');
  });
});
