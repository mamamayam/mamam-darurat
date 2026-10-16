/**
 * deleteRequestMath — pengajuan hapus transaksi (staf mengajukan, owner memutuskan; migrasi 016).
 * FUNGSI MURNI (dites di deleteRequestMath.test.js).
 */

export const REQUEST_STATUS = { PENDING: 'menunggu', APPROVED: 'disetujui', REJECTED: 'ditolak' };

const normalizeStatus = (s) => (Object.values(REQUEST_STATUS).includes(s) ? s : REQUEST_STATUS.PENDING);

/** Baris tabel transaction_delete_requests -> bentuk yang dipakai tampilan. */
export const mapDeleteRequest = (r) => ({
  id: r.id, transactionId: r.transaction_id, number: r.display_number || '', customer: r.customer_name || '',
  orderType: r.order_type || '', paymentMethod: r.payment_method || '', total: Number(r.total) || 0,
  at: r.transaction_at || '', items: r.items_summary || '', reason: r.reason || '', requestedBy: r.requested_by || '',
  status: normalizeStatus(r.status), rejectReason: r.reject_reason || '', createdAt: r.created_at || '',
});

/** Validasi form pengajuan. Mengembalikan nilai yang sudah dirapikan atau melempar Error berpesan Indonesia. */
export function validateDeleteRequest({ reason, requestedBy } = {}) {
  const r = String(reason || '').trim();
  const by = String(requestedBy || '').trim();
  if (!r) throw new Error('Isi alasan kenapa transaksi ini harus dihapus.');
  if (!by) throw new Error('Pilih namamu dulu.');
  return { reason: r, requestedBy: by };
}

/**
 * Indeks per transaksi untuk Riwayat: transactionId -> pengajuan yang relevan.
 * 'menunggu' menang; kalau tidak ada, pengajuan 'ditolak' TERBARU (supaya staf tahu kenapa ditolak).
 * 'disetujui' tidak masuk: transaksinya sudah tidak ada.
 */
export function requestIndex(requests) {
  const map = new Map();
  for (const r of requests || []) {
    if (r.status === REQUEST_STATUS.APPROVED) continue;
    const cur = map.get(r.transactionId);
    if (!cur) { map.set(r.transactionId, r); continue; }
    if (cur.status === REQUEST_STATUS.PENDING) continue;
    if (r.status === REQUEST_STATUS.PENDING || r.createdAt > cur.createdAt) map.set(r.transactionId, r);
  }
  return map;
}

/** Pengajuan yang menunggu, terlama dulu (yang paling lama menunggu di atas). */
export const pendingDeleteRequests = (requests) =>
  (requests || []).filter((r) => r.status === REQUEST_STATUS.PENDING)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
