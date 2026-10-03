import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  roleForPin, recordAttempt, isLocked, secondsLeft, attemptsLeft, initialAttempts,
  readAttempts, makeSession, readSession,
} from './authLogic';
import { can } from './permissions';

/**
 * AuthContext — peran yang sedang masuk (owner / staff) dari PIN hardcoded.
 * Ini pagar tampilan, bukan keamanan data (lihat pins.js).
 * Sesi disimpan di localStorage (12 jam) supaya HP kasir tidak minta PIN
 * tiap aplikasi dibuka; batas percobaan juga disimpan supaya reload halaman
 * tidak menghapus kunci.
 */
const SESSION_KEY = 'mamam-darurat-session';
const ATTEMPTS_KEY = 'mamam-darurat-attempts';

const store = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* penyimpanan penuh/diblokir: sesi hanya di memori */ } },
  remove: (k) => { try { window.localStorage.removeItem(k); } catch { /* abaikan */ } },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => readSession(store.get(SESSION_KEY), Date.now()));
  const [attempts, setAttempts] = useState(() => readAttempts(store.get(ATTEMPTS_KEY), Date.now()));

  /** @returns {{ok:boolean, role?:string, locked?:boolean, attemptsLeft?:number, secondsLeft?:number}} */
  const login = useCallback((pin) => {
    const now = Date.now();
    if (isLocked(attempts, now)) return { ok: false, locked: true, secondsLeft: secondsLeft(attempts, now) };
    const found = roleForPin(pin);
    const next = recordAttempt(attempts, Boolean(found), now);
    setAttempts(next);
    store.set(ATTEMPTS_KEY, JSON.stringify(next));
    if (found) {
      store.set(SESSION_KEY, makeSession(found, now));
      setRole(found);
      return { ok: true, role: found };
    }
    return { ok: false, locked: isLocked(next, now), attemptsLeft: attemptsLeft(next), secondsLeft: secondsLeft(next, now) };
  }, [attempts]);

  const logout = useCallback(() => { store.remove(SESSION_KEY); setRole(null); }, []);

  // Sesi yang kedaluwarsa saat aplikasi dibiarkan terbuka: keluarkan otomatis.
  useEffect(() => {
    if (!role) return undefined;
    const id = setInterval(() => { if (!readSession(store.get(SESSION_KEY), Date.now())) setRole(null); }, 60 * 1000);
    return () => clearInterval(id);
  }, [role]);

  const value = useMemo(() => ({
    role, isOwner: role === 'owner', can: (permission) => can(role, permission), login, logout, attempts,
  }), [role, login, logout, attempts]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider> (main.jsx)');
  return ctx;
}

export { initialAttempts };
