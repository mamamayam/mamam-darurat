import { describe, it, expect } from 'vitest';
import { buildPayslipPdf, textWidth, WIDTHS } from './payslipPdf.js';
import { buildPayrollReport } from './payrollReport.js';

const rp = (n) => `Rp ${n}`;
const latin1 = (bytes) => new TextDecoder('latin1').decode(bytes);

const basePayroll = (over = {}) => ({
  attendance: {
    dayRows: [{ date: '2026-10-07', status: 'hadir', workedMinutes: 540, overtimeMinutes: 0, bolongMinutes: 0, fullTimeBonus: false }, { date: '2026-10-09', status: 'libur' }],
    hadirDays: 1, liburDays: 1, fullTimeDays: 0, totalWorkedMinutes: 540, totalOvertimeMinutes: 0, overtimeBlocks30Min: 0, overtimeRate: 5000,
    wagePay: 135000, overtimePay: 0, fullTimeBonusPay: 0,
  },
  additions: [], deductions: [{ id: 'k', category: 'Kasbon', label: '', amount: 20000, date: '2026-10-08', expenseId: 'x' }],
  additionsTotal: 0, deductionsTotal: 20000, openingBalance: 0, totalPenghasilan: 135000, netPay: 115000, ...over,
});
const make = (over, opts = {}) => buildPayslipPdf({
  employeeName: 'Agung Prayoga', periodLabel: 'Oktober 2026',
  report: buildPayrollReport(basePayroll(over), { formatRupiah: rp }), formatRupiah: (n) => `Rp ${n.toLocaleString('id-ID')}`, ...opts,
});

describe('tabel lebar huruf', () => {
  it('95 karakter ASCII (spasi..~) dan lebar masuk akal', () => {
    expect(WIDTHS).toHaveLength(95);
    expect(textWidth('0', 10)).toBeCloseTo(5.56, 5);          // digit Helvetica = 556
    expect(textWidth('Rp 1', 10, true)).toBeGreaterThan(textWidth('Rp 1', 10));
  });
});

describe('buildPayslipPdf', () => {
  it('menghasilkan PDF valid: header, EOF, xref menunjuk objek yang benar', () => {
    const bytes = make();
    const s = latin1(bytes);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    const xrefAt = Number(/startxref\n(\d+)/.exec(s)[1]);
    expect(s.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const entries = [...s.slice(xrefAt).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThan(5);
    entries.forEach((at, i) => expect(s.slice(at, at + 8)).toBe(`${i + 1} 0 obj\n`));
  });

  it('isi ringkas: pendapatan, kasbon, gaji bersih; TANPA rincian harian', () => {
    const s = latin1(make());
    // tanda kurung di dalam teks PDF di-escape (\\( \\)), jadi "Upah (9j 00m)" tertulis "Upah \\(9j 00m\\)"
    for (const t of ['Slip Gaji \xb7 Mamam Ayam', 'Agung Prayoga \xb7 Oktober 2026', 'Upah \\(9j 00m\\)', 'Total Pendapatan', '(Kasbon)', 'Gaji Bersih', 'Rp 115.000']) expect(s).toContain(t);
    expect(s).not.toContain('Rincian Harian'.toUpperCase());
    expect(s).not.toContain('(Lembur');   // baris Rp 0 disembunyikan
  });

  it('rincian harian ikut kalau diminta, termasuk catatan per tanggal', () => {
    const s = latin1(make({}, { withDays: true }));
    expect(s).toContain('(RINCIAN HARIAN)');
    expect(s).toContain('(7 Okt \xb7 Hadir)');
    expect(s).toContain('(8 Okt)');          // tanggal tanpa absensi tapi ada kasbon
    expect(s).toContain('(Kasbon)');
    expect(s).toContain('(-Rp 20.000)');
  });

  it('karakter khusus di-escape dan teks panjang dipotong, bukan melebar', () => {
    const s = latin1(make({ deductions: [{ id: 'd', category: 'Denda', label: `Piring (pecah) \\ ${'sangat panjang '.repeat(20)}`, amount: 5000, date: '2026-10-07' }], deductionsTotal: 5000 }, { withDays: true }));
    expect(s).toContain('Piring \\(pecah\\) \\\\');
    expect(s).toContain('...');
  });

  it('banyak hari -> pindah halaman, nomor halaman benar', () => {
    const dayRows = Array.from({ length: 31 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, status: 'libur' }));
    const deductions = dayRows.map((d, i) => ({ id: `k${i}`, category: 'Potongan', label: 'x', amount: 1000, date: d.date }));
    const s = latin1(make({ attendance: { ...basePayroll().attendance, dayRows }, deductions, deductionsTotal: 31000 }, { withDays: true }));
    const pages = Number(/\/Count (\d+)/.exec(s)[1]);
    expect(pages).toBeGreaterThan(1);
    expect(s).toContain(`(Hal. ${pages}/${pages})`);
  });
});
