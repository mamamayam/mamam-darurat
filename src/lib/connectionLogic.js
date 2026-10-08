/**
 * connectionLogic — keadaan koneksi aplikasi. FUNGSI MURNI (tanpa window/fetch),
 * supaya bisa dites. Penyimpan keadaan + pendengarnya ada di connection.js.
 *
 * Dua sumber sinyal:
 *  - browser: event online/offline (HP masuk mode pesawat, WiFi putus)
 *  - permintaan ke server yang gagal tersambung (sinyal ada tapi tidak tembus,
 *    server tidak terjangkau). Permintaan yang sengaja dibatalkan (AbortError)
 *    tidak dihitung — itu disaring di connection.js. Satu permintaan yang
 *    berhasil langsung memulihkan status.
 */
export const FAIL_THRESHOLD = 1;

export const initialConn = (online = true) => ({ online: Boolean(online), failures: 0 });

/** event: 'online' | 'offline' | 'fail' | 'ok' */
export function nextConn(st, event) {
  switch (event) {
    case 'offline': return st.online ? { ...st, online: false } : st;
    case 'online':
    case 'ok': return st.online && st.failures === 0 ? st : { online: true, failures: 0 };
    case 'fail': return st.failures >= 99 ? st : { ...st, failures: st.failures + 1 };
    default: return st;
  }
}

/** 'offline' (tidak ada internet) | 'server' (internet ada, server tidak terjangkau) | 'ok' */
export function connStatus(st) {
  if (!st.online) return 'offline';
  return st.failures >= FAIL_THRESHOLD ? 'server' : 'ok';
}

export const CONN_MESSAGES = {
  offline: 'Tidak ada koneksi internet. Data belum bisa dimuat atau disimpan sampai tersambung lagi.',
  server: 'Koneksi ke server terputus. Cek internet kamu, lalu coba lagi.',
  back: 'Tersambung kembali.',
};

/**
 * Gagal memuat potongan kode halaman (lazy import) — hampir selalu karena tidak ada
 * internet saat membuka halaman yang belum pernah dibuka di perangkat ini.
 * Pesan galatnya beda-beda tiap browser.
 */
export function isChunkLoadError(err) {
  const m = String(err?.message ?? err ?? '');
  return /dynamically imported module|importing a module script failed|error loading dynamically imported|loading chunk .* failed|loading css chunk/i.test(m);
}

/**
 * Setelah deploy baru, berkas halaman lama (nama berhash) hilang dari server. Aplikasi yang
 * masih terbuka dari versi lama gagal memuat halaman yang belum pernah dibuka -> perlu
 * muat ulang SEKALI. Jangan mengulang kalau baru saja memuat ulang (cegah putaran tanpa akhir).
 */
export const AUTO_RELOAD_WINDOW_MS = 30 * 1000;
export const shouldAutoReload = (lastAt, now) => !(Number(lastAt) > 0 && Math.abs(now - Number(lastAt)) < AUTO_RELOAD_WINDOW_MS);
