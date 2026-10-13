/**
 * Pemilih mode aplikasi: POS (staf, HP, login PIN) atau HPP (owner, laptop, login email).
 * Keduanya satu domain, satu build. HPP hidup di path `/hpp` dan `/hpp/*`; selain itu = POS.
 *
 * Dipanggil SEKALI di src/main.jsx saat startup. Jangan dicek ulang di dalam komponen.
 * Ini hanya pemilih tampilan: pembatasan data tetap lewat RLS di database, bukan lewat path.
 */
export function isHppPath(pathname) {
  return pathname === '/hpp' || (typeof pathname === 'string' && pathname.startsWith('/hpp/'));
}

// --- Pindah dari POS ke HPP di tab yang SAMA, supaya tombol Back kembali ke POS ---
// (Tab baru punya riwayat kosong: Back langsung keluar aplikasi.)
// location.replace mengganti entri riwayat POS yang sedang aktif (mis. laci menu yang terbuka),
// jadi Back dari HPP mendarat di entri dasar POS yang bersih, bukan di laci yang sudah tidak ada.
const LEAVE_FLAG = 'mamam-leaving-for-hpp';

/** Dipanggil dari POS sebelum pergi ke halaman lain (mis. /hpp). */
export function leaveForHref(href, win = globalThis.window) {
  try { win.sessionStorage.setItem(LEAVE_FLAG, '1'); } catch { /* diblokir: tidak apa-apa */ }
  win.location.replace(href);
}

/**
 * Dipanggil di POS pada setiap `pageshow`. True = halaman ini DIPULIHKAN dari cache back/forward
 * setelah kita pergi ke HPP; isinya (laci terbuka, hitungan riwayat backStack) sudah tidak cocok dengan
 * posisi riwayat browser, jadi harus dimuat ulang. Penanda selalu dihapus.
 */
export function shouldReloadOnReturn(persisted, storage = globalThis.sessionStorage) {
  let flagged = false;
  try {
    flagged = storage?.getItem(LEAVE_FLAG) === '1';
    storage?.removeItem(LEAVE_FLAG);
  } catch { /* abaikan */ }
  return Boolean(persisted) && flagged;
}
