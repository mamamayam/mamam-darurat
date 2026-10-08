/**
 * additionApproval — status persetujuan Tambahan gaji. FUNGSI MURNI.
 *
 * Staf mengajukan Tambahan (bonus, ongkir, potong ayam, dll) dari Beranda; owner
 * memutuskan. Hanya yang 'disetujui' yang boleh masuk hitungan gaji — karena
 * Tambahan menambah uang yang dibayar ke karyawan, jadi itulah yang butuh ACC.
 * Potongan tidak lewat persetujuan.
 *
 * Baris lama (sebelum migrasi 009, atau kolom status belum ada) dianggap
 * 'disetujui' supaya angka gaji lama tidak berubah.
 */
export const ADDITION_STATUS = Object.freeze({ PENDING: 'menunggu', APPROVED: 'disetujui', REJECTED: 'ditolak' });

export const normalizeStatus = (status) =>
  (status === ADDITION_STATUS.PENDING || status === ADDITION_STATUS.REJECTED ? status : ADDITION_STATUS.APPROVED);

/** Boleh dihitung di gaji? (status kosong/tak dikenal = disetujui, data lama) */
export const isCountedAddition = (a) => normalizeStatus(a?.status) === ADDITION_STATUS.APPROVED;

export const isPendingAddition = (a) => normalizeStatus(a?.status) === ADDITION_STATUS.PENDING;

export const countPendingAdditions = (list) => (list || []).filter(isPendingAddition).length;
