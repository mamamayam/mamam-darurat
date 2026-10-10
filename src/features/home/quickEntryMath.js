import { ADDITION_STATUS, normalizeStatus } from '../payroll/additionApproval';

/**
 * quickEntryMath — aturan "Catat Cepat" di Beranda. FUNGSI MURNI (dites).
 *
 * Tiga jalur:
 *  - Tambah (penghasilan karyawan): staf mengajukan -> 'menunggu', owner memutuskan.
 *    Owner yang mencatat langsung 'disetujui'. Hanya ini yang butuh persetujuan.
 *  - Potongan (kasbon, ganti rugi, denda, dll): langsung dicatat; sekaligus jadi
 *    pengeluaran karyawan (tunai = mengurangi saldo Dompet). Lihat RPC catat_potongan.
 *  - Pengeluaran toko: langsung dicatat (form Pengeluaran yang sama).
 *
 * Uang = integer rupiah. Tanggal = string 'YYYY-MM-DD' apa adanya.
 */

export const PAYMENT_METHODS = ['Tunai', 'Non-Tunai'];

/** Keterangan boleh kosong di Catat Cepat: pakai nama kategori. */
export const adjustmentLabel = (label, category) => String(label || '').trim() || String(category || '').trim();

/**
 * Validasi form Tambah/Potongan. Mengembalikan nominal (integer) atau melempar Error
 * berpesan Indonesia. `needsRequester` = staf yang mengajukan Tambahan (wajib isi "Dicatat oleh").
 */
export function validateAdjustment({ employeeId, category, amount, date, requestedBy }, { needsRequester = false } = {}) {
  if (!employeeId) throw new Error('Pilih karyawan.');
  if (!String(category || '').trim()) throw new Error('Pilih kategori.');
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0) throw new Error('Nominal harus angka bulat lebih dari 0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Pilih tanggal.');
  if (needsRequester && !String(requestedBy || '').trim()) throw new Error('Pilih siapa yang mencatat.');
  return amt;
}

/** Baris payroll_additions untuk Tambah baru. Owner = langsung disetujui; staf = menunggu. */
export function newAdditionRow(form, { canApprove, nowISO }) {
  const amount = validateAdjustment(form, { needsRequester: !canApprove });
  const category = form.category.trim();
  return {
    employee_id: form.employeeId,
    label: adjustmentLabel(form.label, category),
    amount,
    date: form.date,
    category,
    source: canApprove ? 'owner' : 'staff',
    status: canApprove ? ADDITION_STATUS.APPROVED : ADDITION_STATUS.PENDING,
    requested_by: canApprove ? null : form.requestedBy.trim(),
    approved_by: canApprove ? 'Owner' : null,
    approved_at: canApprove ? nowISO : null,
  };
}

/** Argumen RPC catat_potongan (potongan gaji + pengeluaran karyawan, satu transaksi). */
export function deductionRpcArgs(form) {
  const amount = validateAdjustment(form);
  const category = form.category.trim();
  return {
    p_employee_id: form.employeeId,
    p_label: adjustmentLabel(form.label, category),
    p_amount: amount,
    p_date: form.date,
    p_category: category,
    p_payment_method: form.paymentMethod === 'Non-Tunai' ? 'Non-Tunai' : 'Tunai',
  };
}

/**
 * Argumen RPC ubah_potongan (migrasi 010): mengubah potongan gaji + pengeluaran karyawannya
 * dalam satu transaksi. Aturan isian SAMA dengan catat_potongan (validasi, keterangan, sumber dana).
 */
export function deductionUpdateArgs(id, form) {
  if (!id) throw new Error('Potongan tidak ditemukan.');
  const amount = validateAdjustment(form);
  const category = form.category.trim();
  return {
    p_deduction_id: id,
    p_label: adjustmentLabel(form.label, category),
    p_amount: amount,
    p_date: form.date,
    p_category: category,
    p_payment_method: form.paymentMethod === 'Non-Tunai' ? 'Non-Tunai' : 'Tunai',
  };
}

/** Total pengeluaran HARI INI: karyawan (terhubung ke karyawan) vs toko. */
export function summarizeTodayExpenses(expenses, today) {
  let karyawan = 0; let toko = 0;
  for (const e of expenses || []) {
    if (String(e.date).slice(0, 10) !== today) continue;
    const amt = Number(e.amount) || 0;
    if (e.employeeId) karyawan += amt; else toko += amt;
  }
  return { karyawan, toko };
}

// ── Pemetaan baris database -> bentuk tampilan ──────────────────────
const dayOf = (v) => (v ? String(v).slice(0, 10) : '');

export const mapAdditionRow = (r, nameById = {}) => ({
  id: r.id, employeeId: r.employee_id, employeeName: nameById[r.employee_id] || 'Karyawan',
  category: r.category, label: r.label, amount: r.amount, date: dayOf(r.date),
  status: normalizeStatus(r.status), requestedBy: r.requested_by || '', rejectReason: r.reject_reason || '',
  createdAt: r.created_at || '',
});

export const mapDeductionRow = (r, nameById = {}) => ({
  id: r.id, employeeId: r.employee_id, employeeName: nameById[r.employee_id] || 'Karyawan',
  category: r.category, label: r.label, amount: r.amount, date: dayOf(r.date),
  expenseId: r.expense_id || null, createdAt: r.created_at || '',
});

export const mapExpenseRow = (r) => ({
  id: r.id, category: r.category, supplier: r.store_or_supplier_name || '', note: r.detail || '',
  amount: r.amount, date: dayOf(r.transaction_date), paymentMethod: r.payment_method,
  employeeId: r.employee_id || null, createdAt: r.created_at || '',
});

/** "HH:mm" lokal dari timestamp ISO; kosong kalau tidak valid. */
export function formatClock(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const firstLine = (text) => String(text || '').split(/\r?\n/).map((t) => t.trim()).find(Boolean) || '';

/**
 * Daftar "Catatan hari ini": Tambah + Potongan + Pengeluaran toko, terbaru dulu.
 * Pengeluaran yang terhubung ke karyawan TIDAK ditampilkan lagi di sini (sudah
 * diwakili baris Potongannya) supaya tidak muncul dobel.
 */
export function buildFeed({ additions = [], deductions = [], expenses = [] }) {
  const items = [
    ...additions.map((a) => ({
      key: `tambah-${a.id}`, id: a.id, kind: 'tambah', title: a.employeeName, tag: a.category, note: a.label,
      amount: a.amount, status: a.status, reason: a.rejectReason, by: a.requestedBy, createdAt: a.createdAt,
    })),
    ...deductions.map((d) => ({
      key: `potongan-${d.id}`, id: d.id, kind: 'potongan', title: d.employeeName, tag: d.category, note: d.label,
      amount: d.amount, status: 'tercatat', reason: '', by: '', createdAt: d.createdAt,
    })),
    ...expenses.filter((e) => !e.employeeId).map((e) => ({
      key: `pengeluaran-${e.id}`, id: e.id, kind: 'pengeluaran', title: e.category, tag: e.supplier, note: firstLine(e.note),
      amount: e.amount, status: 'tercatat', reason: '', by: '', createdAt: e.createdAt,
    })),
  ];
  return items
    .map((i) => ({ ...i, time: formatClock(i.createdAt) }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Tab daftar: 'semua' | 'karyawan' (Tambah + Potongan) | 'toko' (Pengeluaran). */
export function filterFeed(feed, tab) {
  if (tab === 'karyawan') return feed.filter((i) => i.kind !== 'pengeluaran');
  if (tab === 'toko') return feed.filter((i) => i.kind === 'pengeluaran');
  return feed;
}

/** Pengajuan Tambahan yang menunggu, yang paling lama di atas. */
export const pendingRequests = (additions) =>
  (additions || []).filter((a) => a.status === ADDITION_STATUS.PENDING)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

/** Awal hari lokal sebagai ISO (batas "dibuat hari ini"). */
export const startOfLocalDayISO = (today) => {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
};
