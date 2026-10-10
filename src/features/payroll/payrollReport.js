/**
 * payrollReport — susunan data "Laporan Gaji" satu karyawan (periode mingguan DAN bulanan). FUNGSI MURNI (dites).
 *
 * Dipakai tampilan (PayrollReport.jsx) dan slip PDF (payslipPdf.js), jadi angka di layar
 * dan di PDF selalu sama. Semua angka berasal dari hasil payrollEngine; tidak ada hitungan gaji baru di sini.
 *
 * Pengurangan = Kasbon + Potongan lain + Saldo awal (positif = karyawan berutang ke toko).
 * Saldo awal hanya ada di periode BULANAN (`withOpening`); mingguan tanpa baris Saldo awal.
 * Gaji Bersih = Total Pendapatan - Pengurangan (sama dengan netPay engine).
 */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const fmtDay = (iso) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]}`;
export const fmtHM = (min) => `${Math.floor(min / 60)}j ${String(min % 60).padStart(2, '0')}m`;

export const STATUS_LABEL = { hadir: 'Hadir', libur: 'Libur', belumAbsen: 'Belum absen', belumPulang: 'Belum pulang', perluKlarifikasi: 'Perlu klarifikasi' };
export const STATUS_VARIANT = { hadir: 'success', libur: 'neutral', belumAbsen: 'neutral', belumPulang: 'warning', perluKlarifikasi: 'danger' };

// Potongan berkategori "Kasbon" dipisah jadi baris sendiri di rincian gaji.
export const isKasbon = (d) => String(d.category || '').trim().toLowerCase() === 'kasbon';

/** Judul satu catatan: "Kategori" saja kalau keterangan kosong/sama, selain itu "Kategori · Keterangan". */
export const itemTitle = (item) => {
  const label = String(item.label || '').trim();
  return !label || label === item.category ? String(item.category || '') : `${item.category} · ${label}`;
};

/** Ringkasan satu hari hadir: jam kerja + lembur/bolong/FT. Hari lain: kosong. */
export const dayDetail = (row) => {
  if (!row || row.status !== 'hadir') return '';
  return `${fmtHM(row.workedMinutes)}${row.overtimeMinutes > 0 ? ` · lembur ${row.overtimeMinutes}m` : ''}${row.bolongMinutes > 0 ? ` · bolong ${row.bolongMinutes}m` : ''}${row.fullTimeBonus ? ' · FT' : ''}`;
};

/**
 * @param payroll  hasil computePayroll untuk satu karyawan (atau payroll_json periode tertutup)
 * @param opts.formatRupiah  pemformat rupiah (dipakai di label lembur)
 * @param opts.withOpening   sertakan baris Saldo awal (periode bulanan). Default true.
 */
export function buildPayrollReport(payroll, { formatRupiah, withOpening = true }) {
  const a = payroll.attendance;
  const deductions = payroll.deductions || [];
  const additions = payroll.additions || [];

  const income = [
    { key: 'upah', label: `Upah (${fmtHM(a.totalWorkedMinutes)})`, amount: a.wagePay },
    { key: 'lembur', label: `Lembur (${a.totalOvertimeMinutes} mnt → ${a.overtimeBlocks30Min} blok × ${formatRupiah(a.overtimeRate)})`, amount: a.overtimePay },
    { key: 'bonus', label: `Bonus Full Time (${a.fullTimeDays} hari)`, amount: a.fullTimeBonusPay },
    { key: 'tambahan', label: 'Tambahan', amount: payroll.additionsTotal },
  ];
  const totalIncome = payroll.totalPenghasilan ?? income.reduce((s, r) => s + r.amount, 0);

  const kasbon = deductions.filter(isKasbon).reduce((s, d) => s + d.amount, 0);
  const cuts = [
    { key: 'kasbon', label: 'Kasbon', amount: kasbon },
    { key: 'potongan', label: 'Potongan', amount: payroll.deductionsTotal - kasbon },
    ...(withOpening ? [{ key: 'saldo', label: 'Saldo awal', amount: payroll.openingBalance || 0 }] : []),
  ];
  const totalDeductions = cuts.reduce((s, r) => s + r.amount, 0);

  // Catatan Tambahan/Potongan ditaruh di tanggalnya masing-masing. Tanggal tanpa absensi tetap tampil.
  const itemsByDate = new Map();
  const put = (date, item) => { if (!itemsByDate.has(date)) itemsByDate.set(date, []); itemsByDate.get(date).push(item); };
  for (const x of additions) put(x.date, { kind: 'tambahan', id: x.id, category: x.category, label: x.label, amount: x.amount });
  for (const x of deductions) put(x.date, { kind: 'potongan', id: x.id, category: x.category, label: x.label, amount: x.amount, expenseId: x.expenseId || null, employeeId: x.employeeId, date: x.date });

  const rowByDate = new Map(a.dayRows.map((r) => [r.date, r]));
  const dates = [...new Set([...rowByDate.keys(), ...itemsByDate.keys()])].sort();
  const days = dates.map((date) => ({ date, row: rowByDate.get(date) || null, items: itemsByDate.get(date) || [] }));

  return {
    income, totalIncome, cuts, totalDeductions, net: payroll.netPay, days,
    hadirDays: a.hadirDays, liburDays: a.liburDays, workedMinutes: a.totalWorkedMinutes,
  };
}
