/**
 * Login HPP: Supabase Auth (email + password) + pemeriksaan admin HPP (fungsi hpp_is_admin()).
 * Akun harus terdaftar di tabel hpp_admin, jadi staf POS yang sudah login TIDAK otomatis bisa masuk.
 * Semua fungsi menerima klien `db` supaya bisa dites.
 */
import { explainError } from './hppRepo';

/**
 * Akun owner POS memakai password "mamam:" + PIN (docs/auth-setup.md). Kalau yang diketik cuma 4 digit,
 * awalan itu ditambahkan otomatis. Password lain dipakai apa adanya.
 */
export function passwordDariIsian(teks) {
  const s = String(teks ?? '');
  return /^\d{4}$/.test(s) ? `mamam:${s}` : s;
}

async function cekAdmin(db) {
  const { data, error } = await db.rpc('hpp_is_admin');
  if (error) throw Object.assign(new Error(explainError(error).pesan), { cause: error });
  return data === true;
}

/** Kembalikan { email } kalau berhasil, atau { error: 'pesan' }. */
export async function masuk(db, email, password) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !password) return { error: 'Isi email dan password' };
  const { data, error } = await db.auth.signInWithPassword({ email: e, password: passwordDariIsian(password) });
  if (error) {
    if (/invalid login|invalid credentials/i.test(error.message)) return { error: 'Email atau password salah. Coba lagi' };
    return { error: explainError(error).pesan };
  }
  try {
    if (!(await cekAdmin(db))) {
      await db.auth.signOut();
      return { error: 'Akun ini tidak punya akses HPP.' };
    }
  } catch (err) {
    await db.auth.signOut();
    return { error: err.message };
  }
  return { email: data?.user?.email || e };
}

/** Pulihkan sesi yang tersimpan. { email } kalau masih berlaku dan admin, selain itu null. */
export async function pulihkanSesi(db) {
  try {
    const { data } = await db.auth.getSession();
    if (!data?.session) return null;
    if (!(await cekAdmin(db))) { await db.auth.signOut(); return null; }
    return { email: data.session.user?.email || '' };
  } catch {
    return null;
  }
}

export async function keluar(db) {
  try { await db.auth.signOut(); } catch { /* sesi lokal tetap dibersihkan di bawah */ }
}
