/**
 * Login DUMMY untuk halaman /hpp (tahap percobaan).
 *
 * Ini BUKAN pengaman: kredensialnya tertulis di kode yang diunduh browser. Gunanya hanya
 * memisahkan tampilan login dari isi. Sebelum data HPP sungguhan dimuat, ganti dengan
 * Supabase Auth (email + password) dan jaga data lewat RLS (lihat PRD Routing, bagian 5.7).
 */
export const DEMO_EMAIL = 'owner@mamam.test';
export const DEMO_PASSWORD = 'hpp123';
const KEY = 'mamam-hpp-dummy-session';

/** Mengembalikan pesan galat (string) kalau tidak valid, atau null kalau boleh masuk. */
export function validateLogin(email, password) {
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');
  if (!e || !p) return 'Isi email dan password';
  if (e !== DEMO_EMAIL || p !== DEMO_PASSWORD) return 'Email atau password salah. Coba lagi';
  return null;
}

export function readSession(storage = globalThis.sessionStorage) {
  try { return storage?.getItem(KEY) === DEMO_EMAIL ? DEMO_EMAIL : null; } catch { return null; }
}
export function saveSession(email, storage = globalThis.sessionStorage) {
  try { storage?.setItem(KEY, email); } catch { /* diblokir: login hilang saat refresh, tidak apa-apa */ }
}
export function clearSession(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(KEY); } catch { /* abaikan */ }
}
