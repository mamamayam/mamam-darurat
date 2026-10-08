import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';

/**
 * usePendingApprovals — jumlah pengajuan Tambahan yang menunggu keputusan owner,
 * dipakai badge merah di ikon Beranda (BottomNav) supaya owner tahu ada laporan masuk
 * walau sedang di layar lain.
 *
 * Toko kecil, jadi cukup polling ringan (tiap 60 detik + saat aplikasi dibuka kembali),
 * bukan realtime. Kalau migrasi 009 belum dijalankan, kolom `status` tidak ada:
 * hitungannya diam-diam 0 (tidak mengganggu layar lain).
 */
let count = 0;
const listeners = new Set();

export function setPendingApprovals(n) {
  const next = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (next === count) return;
  count = next;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Jumlah saat ini (untuk badge). */
export const usePendingApprovals = () => useSyncExternalStore(subscribe, () => count, () => 0);

/** Hitung ulang dari database. */
export async function refreshPendingApprovals() {
  const { count: n, error } = await supabase.from('payroll_additions')
    .select('id', { count: 'exact', head: true }).eq('status', 'menunggu');
  setPendingApprovals(error ? 0 : n);
}

/** Pasang sekali di App: poll hanya kalau yang login boleh menyetujui (owner). */
export function usePendingApprovalsPoller(enabled) {
  useEffect(() => {
    if (!enabled) { setPendingApprovals(0); return undefined; }
    const tick = () => { if (document.visibilityState === 'visible') refreshPendingApprovals(); };
    tick();
    const timer = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); setPendingApprovals(0); };
  }, [enabled]);
}
