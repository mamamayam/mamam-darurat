import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  roleForPin, recordAttempt, isLocked, secondsLeft, attemptsLeft, initialAttempts,
  readAttempts, makeSession, readSession, pinToPassword, emailForRole, roleForEmail, maskEmail,
  sessionMsFromHours, isValidPin, SESSION_MS,
} from './authLogic';
import { AUTH_CONFIG, AUTH_ENABLED, OPENED_FROM_RECOVERY_LINK } from './authConfig';
import { can, ROLES } from './permissions';
import { supabase } from '../lib/supabase';

/**
 * AuthContext — peran yang sedang masuk (owner / staff).
 *
 * Dua mode (lihat authConfig.js):
 *  - SUPABASE AUTH (VITE_AUTH_OWNER_EMAIL terisi): owner & staf adalah dua akun
 *    Supabase Auth; PIN 4 digit = password (diberi awalan, lihat authLogic).
 *    Lupa PIN lewat email reset.
 *  - MODE LAMA (env kosong): PIN lokal di pins.js, supaya tidak terkunci selama
 *    transisi.
 * Di kedua mode: batas 3x salah dihitung di aplikasi (localStorage), sesi
 * aplikasi punya masa berlaku sendiri (Pengaturan -> Lama sesi).
 */
const SESSION_KEY = 'mamam-darurat-session';
const ATTEMPTS_KEY = 'mamam-darurat-attempts';

const store = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* penyimpanan penuh/diblokir: sesi hanya di memori */ } },
  remove: (k) => { try { window.localStorage.removeItem(k); } catch { /* abaikan */ } },
};

const AuthContext = createContext(null);

const isCredentialError = (e) => e && (e.code === 'invalid_credentials' || /invalid login credentials/i.test(e.message || ''));
const friendlyAuthError = (e) => {
  const m = e?.message || '';
  if (/same|different from the old/i.test(m)) return 'PIN baru harus berbeda dari PIN lama.';
  if (/rate limit|too many|after \d+ seconds/i.test(m)) return 'Terlalu sering meminta email. Tunggu beberapa menit lalu coba lagi.';
  if (/failed to fetch|network|fetch/i.test(m)) return 'Tidak bisa terhubung ke server. Cek internet lalu coba lagi.';
  return m || 'Terjadi kesalahan.';
};

/** Lama sesi dari tabel app_settings (kalau belum ada / gagal dibaca: bawaan 12 jam). */
async function loadSessionMs() {
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'session_hours').maybeSingle();
    return sessionMsFromHours(data?.value);
  } catch { return SESSION_MS; }
}

export function AuthProvider({ children }) {
  // Mode Supabase: peran baru dipastikan setelah sesi Supabase dicek (ready). Mode lama: langsung dari penyimpanan.
  const [role, setRole] = useState(() => (AUTH_ENABLED ? null : readSession(store.get(SESSION_KEY), Date.now())));
  const [ready, setReady] = useState(!AUTH_ENABLED);
  const [recovery, setRecovery] = useState(null);       // { role } saat halaman dibuka dari tautan Lupa PIN
  const [notice, setNotice] = useState('');             // pesan sekali tampil di layar login (mis. PIN baru tersimpan)
  const [attempts, setAttempts] = useState(() => readAttempts(store.get(ATTEMPTS_KEY), Date.now()));
  const attemptsRef = useRef(attempts);
  const saveAttempts = useCallback((next) => {
    attemptsRef.current = next;
    setAttempts(next);
    store.set(ATTEMPTS_KEY, JSON.stringify(next));
  }, []);

  // ── Mode Supabase: pulihkan sesi & dengarkan tautan reset ─────────
  useEffect(() => {
    if (!AUTH_ENABLED) return undefined;
    let alive = true;
    const enterRecovery = (session) => {
      store.remove(SESSION_KEY);
      setRole(null);
      setRecovery({ role: roleForEmail(session?.user?.email, AUTH_CONFIG) });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') enterRecovery(session);
      else if (event === 'SIGNED_OUT') setRole(null);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const session = data?.session;
      if (session && OPENED_FROM_RECOVERY_LINK) { enterRecovery(session); }
      else {
        const saved = readSession(store.get(SESSION_KEY), Date.now());
        const sessionRole = roleForEmail(session?.user?.email, AUTH_CONFIG);
        if (session && saved && saved === sessionRole) setRole(saved);
        else {
          // sesi aplikasi habis / tidak cocok: bersihkan sisa sesi Supabase
          store.remove(SESSION_KEY);
          if (session) supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
      }
      setReady(true);
    }).catch(() => { if (alive) setReady(true); });
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
  }, []);

  /**
   * Coba masuk dengan PIN. Selalu async (mode Supabase memanggil server).
   * @returns {Promise<{ok:boolean, role?:string, locked?:boolean, attemptsLeft?:number, secondsLeft?:number, networkError?:string}>}
   */
  const login = useCallback(async (pin) => {
    const now = Date.now();
    const cur = attemptsRef.current;
    if (isLocked(cur, now)) return { ok: false, locked: true, secondsLeft: secondsLeft(cur, now) };

    let found = null;
    if (AUTH_ENABLED) {
      if (!isValidPin(pin)) found = null;
      else {
        for (const r of ROLES) {                         // owner dulu, lalu staf
          // eslint-disable-next-line no-await-in-loop
          const { data, error } = await supabase.auth.signInWithPassword({ email: emailForRole(r, AUTH_CONFIG), password: pinToPassword(pin) });
          if (!error && data?.session) { found = r; break; }
          if (!isCredentialError(error)) return { ok: false, networkError: friendlyAuthError(error) };   // gangguan jaringan: bukan PIN salah, tidak dihitung
        }
      }
    } else {
      found = roleForPin(pin);
    }

    const at = Date.now();
    const next = recordAttempt(attemptsRef.current, Boolean(found), at);
    saveAttempts(next);
    if (found) {
      const ttl = AUTH_ENABLED ? await loadSessionMs() : SESSION_MS;
      store.set(SESSION_KEY, makeSession(found, Date.now(), ttl));
      setRole(found);
      return { ok: true, role: found };
    }
    return { ok: false, locked: isLocked(next, at), attemptsLeft: attemptsLeft(next), secondsLeft: secondsLeft(next, at) };
  }, [saveAttempts]);

  const logout = useCallback(() => {
    store.remove(SESSION_KEY);
    setRole(null);
    if (AUTH_ENABLED) supabase.auth.signOut({ scope: 'local' }).catch(() => {});   // 'local': tidak mengeluarkan perangkat lain
  }, []);

  // Sesi yang kedaluwarsa saat aplikasi dibiarkan terbuka: keluarkan otomatis.
  useEffect(() => {
    if (!role) return undefined;
    const id = setInterval(() => { if (!readSession(store.get(SESSION_KEY), Date.now())) logout(); }, 60 * 1000);
    return () => clearInterval(id);
  }, [role, logout]);

  // ── Lupa PIN / ganti PIN (hanya mode Supabase) ─────────────────────
  /** Kirim email reset untuk akun `targetRole`. @returns {Promise<{ok:boolean, sentTo?:string, message?:string}>} */
  const requestPinReset = useCallback(async (targetRole) => {
    if (!AUTH_ENABLED) return { ok: false, message: 'Lupa PIN butuh login Supabase. Isi VITE_AUTH_OWNER_EMAIL dulu (lihat docs/auth-setup.md).' };
    const email = emailForRole(targetRole, AUTH_CONFIG);
    if (!email) return { ok: false, message: 'Pilih akun yang PIN-nya lupa.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
    if (error) return { ok: false, message: friendlyAuthError(error) };
    return { ok: true, sentTo: maskEmail(email) };
  }, []);

  const updatePin = useCallback(async (newPin) => {
    if (!isValidPin(newPin)) return { ok: false, message: 'PIN harus 4 digit angka.' };
    const { error } = await supabase.auth.updateUser({ password: pinToPassword(newPin) });
    return error ? { ok: false, message: friendlyAuthError(error) } : { ok: true };
  }, []);

  /** Selesaikan reset dari tautan email: simpan PIN baru lalu kembali ke layar login. */
  const completeRecovery = useCallback(async (newPin) => {
    const r = await updatePin(newPin);
    if (!r.ok) return r;
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    store.remove(SESSION_KEY);
    saveAttempts(initialAttempts());
    setRole(null);
    setRecovery(null);
    setNotice('PIN baru tersimpan. Silakan masuk.');
    try { window.history.replaceState(null, '', `${window.location.pathname}`); } catch { /* abaikan */ }
    return { ok: true };
  }, [updatePin, saveAttempts]);

  const cancelRecovery = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    store.remove(SESSION_KEY);
    setRecovery(null);
    try { window.history.replaceState(null, '', `${window.location.pathname}`); } catch { /* abaikan */ }
  }, []);

  /** Ganti PIN akun yang sedang masuk (Pengaturan). */
  const changeOwnPin = useCallback((newPin) => (AUTH_ENABLED ? updatePin(newPin) : Promise.resolve({ ok: false, message: 'Ganti PIN lewat Pengaturan butuh login Supabase.' })), [updatePin]);

  const value = useMemo(() => ({
    role, isOwner: role === 'owner', can: (permission) => can(role, permission), login, logout, attempts,
    ready, authEnabled: AUTH_ENABLED, recovery, notice, clearNotice: () => setNotice(''), requestPinReset, completeRecovery, cancelRecovery, changeOwnPin,
    ownerEmailMasked: maskEmail(AUTH_CONFIG.ownerEmail), staffEmailMasked: maskEmail(AUTH_CONFIG.staffEmail),
  }), [role, login, logout, attempts, ready, recovery, notice, requestPinReset, completeRecovery, cancelRecovery, changeOwnPin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider> (main.jsx)');
  return ctx;
}

export { initialAttempts };
