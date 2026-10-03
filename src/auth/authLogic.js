import { PINS } from './pins.js';
import { ROLES } from './permissions.js';

/**
 * authLogic — aturan login. FUNGSI MURNI (waktu selalu dioper, tidak ada
 * Date.now() tersembunyi), jadi bisa dites tanpa menunggu.
 */
export const MAX_ATTEMPTS = 5;                    // PIN salah berturut-turut sebelum dikunci
export const LOCK_MS = 30 * 1000;                 // lama dikunci
export const SESSION_MS = 12 * 60 * 60 * 1000;    // sesi berlaku 12 jam

/** Peran untuk PIN itu, atau null kalau salah. */
export function roleForPin(pin) {
  const p = String(pin ?? '');
  if (!/^\d{4}$/.test(p)) return null;
  return ROLES.find((r) => PINS[r] === p) || null;
}

// ── Batas percobaan ─────────────────────────────────────────────────
export const initialAttempts = () => ({ fails: 0, lockedUntil: 0 });
export const isLocked = (st, now) => st.lockedUntil > now;
export const secondsLeft = (st, now) => Math.max(0, Math.ceil((st.lockedUntil - now) / 1000));
export const attemptsLeft = (st) => Math.max(0, MAX_ATTEMPTS - st.fails);

/** Keadaan baru setelah satu percobaan. Selama terkunci, percobaan diabaikan. */
export function recordAttempt(st, ok, now) {
  if (isLocked(st, now)) return st;
  if (ok) return initialAttempts();
  const fails = st.fails + 1;
  return fails >= MAX_ATTEMPTS ? { fails: 0, lockedUntil: now + LOCK_MS } : { fails, lockedUntil: 0 };
}

export function readAttempts(raw, now) {
  try {
    const s = JSON.parse(raw);
    if (!s || !Number.isInteger(s.fails) || !Number.isFinite(s.lockedUntil)) return initialAttempts();
    if (s.fails < 0 || s.fails >= MAX_ATTEMPTS) return initialAttempts();
    // kunci yang janggal panjang (jam perangkat diutak-atik) dibuang
    if (s.lockedUntil > now + LOCK_MS * 2) return initialAttempts();
    return { fails: s.fails, lockedUntil: s.lockedUntil };
  } catch { return initialAttempts(); }
}

// ── Sesi ────────────────────────────────────────────────────────────
export const makeSession = (role, now) => JSON.stringify({ role, at: now });

/** Peran dari sesi tersimpan, atau null (rusak / peran asing / kedaluwarsa / dari masa depan). */
export function readSession(raw, now) {
  try {
    const s = JSON.parse(raw);
    if (!s || !ROLES.includes(s.role) || !Number.isFinite(s.at)) return null;
    if (now - s.at > SESSION_MS) return null;
    if (s.at > now + 60 * 1000) return null;
    return s.role;
  } catch { return null; }
}
