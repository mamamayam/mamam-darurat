import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mapAdditionRow, pendingRequests } from '../features/home/quickEntryMath';
import { notifyApprovalsChanged } from './usePendingApprovals';

/**
 * usePendingAdditions — pengajuan Tambahan karyawan yang menunggu keputusan owner, untuk sheet Persetujuan.
 * (Dulu kartu ini ada di Beranda; sekarang satu tempat bersama pengajuan hapus transaksi.)
 * Kolom `status` belum ada (migrasi 009 belum dijalankan) = tidak ada pengajuan.
 */
export function usePendingAdditions(enabled) {
  const [list, setList] = useState([]);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const [adds, emps] = await Promise.all([
      supabase.from('payroll_additions').select('*').eq('status', 'menunggu').order('created_at'),
      supabase.from('employees').select('id, name'),
    ]);
    if (adds.error) { setList([]); return; }
    const nameById = Object.fromEntries((emps.data || []).map((e) => [e.id, e.name]));
    setList(pendingRequests((adds.data || []).map((r) => mapAdditionRow(r, nameById))));
  }, [enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { list, reload };
}

/** Owner: setujui / tolak pengajuan Tambahan. Menolak 'sudah diputuskan di perangkat lain' dengan jelas. */
export async function decideAddition(id, approve, reason = '') {
  const patch = approve
    ? { status: 'disetujui', approved_by: 'Owner', approved_at: new Date().toISOString(), reject_reason: null }
    : { status: 'ditolak', reject_reason: String(reason).trim() || null, approved_by: null, approved_at: null };
  const { data, error } = await supabase.from('payroll_additions').update(patch).eq('id', id).eq('status', 'menunggu').select('id');
  if (error) throw new Error(`${approve ? 'Gagal menyetujui' : 'Gagal menolak'}: ${error.message}`);
  notifyApprovalsChanged();
  if (!data || data.length === 0) throw new Error('Pengajuan ini sudah diputuskan sebelumnya. Tampilan sudah diperbarui.');
}
