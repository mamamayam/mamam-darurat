import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { deviceRpcArg } from '../lib/deviceId';
import { mapDeleteRequest, validateDeleteRequest, requestIndex, pendingDeleteRequests } from '../features/approvals/deleteRequestMath';
import { notifyApprovalsChanged } from './usePendingApprovals';

/**
 * useDeleteRequests — pengajuan hapus transaksi (migrasi 016), ONLINE-FIRST.
 *
 *  Staf   : ajukanHapusTransaksi() dari Detail transaksi di Riwayat; status pengajuannya terbaca lewat useDeleteRequestIndex.
 *  Owner  : putuskanHapusTransaksi() dari sheet Persetujuan (setuju = transaksi dihapus permanen oleh database).
 *
 * Kalau migrasi 016 belum dijalankan: membaca diam-diam kosong (layar lain tidak terganggu),
 * mengajukan/memutuskan memberi pesan jelas untuk menjalankan migrasinya.
 */
const MIGRATION_HINT = 'Fitur ini butuh migrasi baru: jalankan supabase/migrations/016_hapus_transaksi.sql di SQL Editor dulu.';
const MISSING = ['PGRST202', 'PGRST205', '42883', '42P01'];
const missing = (e) => MISSING.includes(e?.code) || /schema cache|does not exist/i.test(e?.message || '');

/** Pesan galat RPC dari database (raise exception) apa adanya; fungsi/tabel hilang = petunjuk migrasi. */
const fail = (error, aksi) => {
  if (missing(error)) throw new Error(MIGRATION_HINT);
  if (error.code === '23505') throw new Error('Transaksi ini sudah diajukan untuk dihapus, tunggu keputusan owner.');
  throw new Error(error.code === 'P0001' ? error.message : `${aksi}: ${error.message}`);
};

export async function ajukanHapusTransaksi(transactionId, form) {
  const { reason, requestedBy } = validateDeleteRequest(form);
  const { error } = await supabase.rpc('ajukan_hapus_transaksi', {
    p_transaction_id: transactionId, p_reason: reason, p_requested_by: requestedBy, ...deviceRpcArg(),
  });
  if (error) fail(error, 'Gagal mengajukan hapus');
  notifyApprovalsChanged();
}

/** Owner: setujui (transaksi dihapus permanen) atau tolak. Mengembalikan 'disetujui' | 'ditolak'. */
export async function putuskanHapusTransaksi(requestId, approve, reason = '') {
  const { data, error } = await supabase.rpc('putuskan_hapus_transaksi', { p_request_id: requestId, p_approve: approve, p_reason: reason || null });
  if (error) { notifyApprovalsChanged(); fail(error, approve ? 'Gagal menyetujui' : 'Gagal menolak'); }
  notifyApprovalsChanged();
  return data;
}

const COLUMNS = '*';
const sevenDaysAgoISO = () => new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

/**
 * Pengajuan untuk Riwayat: yang menunggu + yang ditolak 7 hari terakhir, jadi indeks per transaksi
 * (menunggu menang). Migrasi belum ada = indeks kosong.
 */
export function useDeleteRequestIndex() {
  const [index, setIndex] = useState(() => new Map());
  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('transaction_delete_requests').select(COLUMNS)
      .or(`status.eq.menunggu,and(status.eq.ditolak,decided_at.gte.${sevenDaysAgoISO()})`);
    setIndex(error ? new Map() : requestIndex((data || []).map(mapDeleteRequest)));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { index, reload };
}

/** Daftar pengajuan hapus yang menunggu (untuk sheet Persetujuan owner). */
export function usePendingDeleteRequests(enabled) {
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const { data, error: e } = await supabase.from('transaction_delete_requests').select(COLUMNS).eq('status', 'menunggu').order('created_at');
    if (e) { setList([]); setError(missing(e) ? MIGRATION_HINT : e.message); return; }
    setList(pendingDeleteRequests((data || []).map(mapDeleteRequest)));
    setError(null);
  }, [enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { list, error, reload };
}
