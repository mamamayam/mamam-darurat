/**
 * navPersist — simpan layar yang sedang dibuka di sessionStorage supaya refresh halaman
 * (tarik-ke-bawah / tombol reload) tetap di layar yang sama, bukan balik ke Beranda.
 * sessionStorage (bukan localStorage): hilang saat tab/aplikasi ditutup, jadi membuka
 * aplikasi baru tetap mulai dari Beranda. Logout menimpanya dengan Beranda.
 */
export const NAV_KEY = 'mamam.nav';

/** Baca layar tersimpan; null kalau tidak ada / rusak / layarnya sudah tidak ada. */
export function readSavedNav(isValidView, storage = globalThis.sessionStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(NAV_KEY) || 'null');
    if (!raw || typeof raw.view !== 'string' || !isValidView(raw.view)) return null;
    const history = Array.isArray(raw.history) ? raw.history.filter((v) => typeof v === 'string' && isValidView(v)) : [];
    return { view: raw.view, history };
  } catch { return null; }
}

export function saveNav(view, history, storage = globalThis.sessionStorage) {
  try { storage?.setItem(NAV_KEY, JSON.stringify({ view, history })); } catch { /* storage penuh / diblokir: abaikan */ }
}
