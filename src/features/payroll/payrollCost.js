/**
 * payrollCost — upah kotor per karyawan yang dibekukan saat Tutup Periode Gaji
 * (kolom payroll_closing_lines.gross_cost / kasbon_total). FUNGSI MURNI.
 *
 * Upah kotor = upah + bonus full time + lembur + tambahan − potongan NON-kasbon.
 * Kasbon dipisah karena itu piutang ke karyawan, bukan upah.
 * `r` = satu elemen keluaran usePayrollData (per karyawan).
 */

const num = (v) => Number(v) || 0;
export const isKasbon = (category) => String(category ?? '').trim().toLowerCase().startsWith('kasbon');

export function employeeGrossCost(r) {
  const p = r.payroll, a = p.attendance;
  const potonganNonKasbon = p.deductions.filter(d => !isKasbon(d.category)).reduce((s, d) => s + num(d.amount), 0);
  const kasbon = p.deductions.filter(d => isKasbon(d.category)).reduce((s, d) => s + num(d.amount), 0);
  return { gross: a.wagePay + a.fullTimeBonusPay + a.overtimePay + p.additionsTotal - potonganNonKasbon, kasbon };
}
