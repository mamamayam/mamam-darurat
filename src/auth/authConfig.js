import { staffEmailFrom } from './authLogic.js';

/**
 * Konfigurasi login Supabase Auth, dari environment (.env.local / Vercel).
 *
 *   VITE_AUTH_OWNER_EMAIL   email akun owner. Surel "Lupa PIN" masuk ke sini.
 *   VITE_AUTH_STAFF_EMAIL   (opsional) email akun staf. Kalau kosong dipakai
 *                           alias: nama+staf@domain (Gmail -> kotak surat sama).
 *
 * Kalau VITE_AUTH_OWNER_EMAIL kosong, aplikasi memakai MODE LAMA (PIN lokal di
 * pins.js) supaya tidak terkunci selama transisi. Lihat docs/auth-setup.md.
 */
const clean = (v) => String(v ?? '').trim().toLowerCase();
const ownerEmail = clean(import.meta.env.VITE_AUTH_OWNER_EMAIL);
const staffEmail = clean(import.meta.env.VITE_AUTH_STAFF_EMAIL) || staffEmailFrom(ownerEmail);

export const AUTH_CONFIG = { ownerEmail, staffEmail };
export const AUTH_ENABLED = Boolean(
  ownerEmail && staffEmail && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

/** Dibaca SEKALI saat modul dimuat: halaman dibuka dari tautan "Lupa PIN" di email? */
export const OPENED_FROM_RECOVERY_LINK =
  typeof window !== 'undefined' && /(^|[#&?])type=recovery\b/.test(`${window.location.hash}${window.location.search}`);
