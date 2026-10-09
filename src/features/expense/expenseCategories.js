import { isKasbon } from '../payroll/payrollCost';

/**
 * Kategori yang boleh dipilih di form Pengeluaran (toko). Kasbon TIDAK ditawarkan di sini:
 * kasbon hanya dicatat sebagai Potongan karyawan lewat Catat Cepat (yang otomatis jadi
 * pengeluaran karyawan, tetap masuk gaji, Dompet, dan Laporan). FUNGSI MURNI (dites).
 */
export const storeExpenseCategories = (categories) => (categories || []).filter((c) => !isKasbon(c));
