import { useSyncExternalStore } from 'react';
import { initialConn, nextConn, connStatus, FAIL_THRESHOLD } from './connectionLogic.js';

/**
 * connection — penyimpan keadaan koneksi (dipakai ConnectionBanner).
 * Diisi dari event online/offline browser dan dari tiap permintaan Supabase
 * (lewat trackedFetch yang dipasang di klien Supabase).
 */
let state = initialConn(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
const subs = new Set();

function dispatch(event) {
  const next = nextConn(state, event);
  if (next === state) return;
  state = next;
  subs.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => dispatch('offline'));
  window.addEventListener('online', () => dispatch('online'));
}

const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

/** Status saat ini (di luar React; dipakai tes). */
export const currentConnectionStatus = () => connStatus(state);

/** 'ok' | 'offline' | 'server' */
export const useConnectionStatus = () => useSyncExternalStore(subscribe, () => connStatus(state), () => 'ok');

/** Pesan ramah untuk kegagalan jaringan (menggantikan "TypeError: Failed to fetch" yang tampil di layar). */
export const networkMessage = () => (
  typeof navigator !== 'undefined' && navigator.onLine === false
    ? 'Tidak ada koneksi internet.'
    : 'Tidak bisa terhubung ke server. Cek internet lalu coba lagi.'
);

/**
 * Pengganti fetch untuk klien Supabase:
 *  - hasil tiap permintaan ikut mengabari status koneksi (ConnectionBanner);
 *  - permintaan yang gagal tersambung TIDAK dilempar sebagai "TypeError: Failed to fetch",
 *    melainkan dijawab status 599 (tidak di-retry otomatis oleh postgrest) dengan pesan ramah. Supabase lalu mengembalikannya sebagai
 *    `error.message` biasa, jadi semua layar yang menampilkan error ikut rapi tanpa diubah satu-satu.
 *  - permintaan yang sengaja dibatalkan (AbortError) tetap dilempar apa adanya.
 */
export async function trackedFetch(input, init) {
  try {
    const res = await fetch(input, init);
    dispatch('ok');                                   // ada balasan (status berapa pun) = server terjangkau
    return res;
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    dispatch('fail');
    const message = networkMessage();
    return new Response(JSON.stringify({ message, msg: message, error_description: message, code: 'NETWORK_ERROR' }), {
      status: 599, statusText: 'Network Error', headers: { 'content-type': 'application/json' },
    });
  }
}

/** Tombol "Coba lagi": cek langsung ke server. @returns {Promise<boolean>} true kalau terjangkau */
export async function checkConnection() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    await fetch(`${url}/rest/v1/`, { headers: { apikey: key }, signal: ctrl.signal, cache: 'no-store' });
    dispatch('ok');
    return true;
  } catch {
    for (let i = 0; i < FAIL_THRESHOLD; i++) dispatch('fail');   // timeout/gagal: pastikan banner tetap tampil
    return false;
  } finally {
    clearTimeout(timer);
  }
}
