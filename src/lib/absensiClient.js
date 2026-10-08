import { createClient } from '@supabase/supabase-js';
import { trackedFetch } from './connection';

/**
 * Klien BACA-SAJA ke database sistem absensi (project Supabase A, tabel
 * `attendanceLog`). Ini project yang BERBEDA dari project C (src/lib/supabase.js).
 *
 * Diisi lewat .env.local (jangan ditempel di chat / jangan di-commit):
 *   VITE_ABSENSI_SUPABASE_URL=https://xxxx.supabase.co     (tanpa /rest/v1/)
 *   VITE_ABSENSI_SUPABASE_ANON_KEY=eyJ...                   (anon public key project A)
 *
 * Anon key project A memang sudah dipakai publik oleh web absensi karyawan,
 * jadi menaruhnya di frontend C tidak menambah paparan. C TIDAK PERNAH menulis
 * ke database ini — hanya membaca.
 *
 * Kalau env belum diisi, absensiClient = null dan halaman Penggajian
 * menampilkan petunjuk pengisian (bukan angka nol yang menyesatkan).
 */
const url = import.meta.env.VITE_ABSENSI_SUPABASE_URL;
const key = import.meta.env.VITE_ABSENSI_SUPABASE_ANON_KEY;

export const absensiConfigured = Boolean(url && key);

// Tanpa sesi/penyimpanan login: klien ini cuma membaca data publik.
export const absensiClient = absensiConfigured
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: trackedFetch } })
  : null;
