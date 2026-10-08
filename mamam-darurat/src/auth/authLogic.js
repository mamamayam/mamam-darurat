import { PINS } from './pins.js';
import { ROLES } from './permissions.js';

/**
 * authLogic — aturan login. FUNGSI MURNI (waktu selalu dioper, tidak ada
 * Date.now() tersembunyi), jadi bisa dites tanpa menunggu.
 */
export const MAX_ATTEMPTS = 3;                    // PIN salah berturut-turut sebelum dikunci + muncul "Lupa PIN"
export const LOCK_MS = 15 * 60 * 1000;            // lama dikunci (bisa dipercepat lewat Lupa PIN)
export const SESSION_MS = 12 * 60 * 60 * 1000;    // sesi berlaku 12 jam (bisa diubah owner di Pengaturan)
const HOUR_MS = 60 * 60 * 1000;
export const SESSION_HOURS_OPTIONS = [1, 12, 24, 168];   // pilihan di Pengaturan

/** Batas percobaan untuk PIN karyawan (lihat gaji sendiri): sama 3x, kunci 5 menit. */
export const EMPLOYEE_ATTEMPT_RULES = { max: 3, lockMs: 5 * 60 * 1000 };
const LOGIN_RULES = { max: MAX_ATTEMPTS, lockMs: LOCK_MS };

export const isValidPin = (pin) => /^\d{4}$/.test(String(pin ?? ''));

/** Peran untuk PIN itu, atau null kalau salah. Hanya dipakai di MODE LAMA (tanpa Supabase Auth). */
export function roleForPin(pin) {
  const p = String(pin ?? '');
  if (!isValidPin(p)) return null;
  return ROLES.find((r) => PINS[r] === p) || null;
}

// ── Akun Supabase Auth ──────────────────────────────────────────────
// Supabase Auth minta password >= 6 karakter, PIN cuma 4 digit, jadi password
// akun = awalan tetap + PIN. Awalan ini BUKAN rahasia (ikut ke browser); yang
// menjaga akun adalah PIN-nya dan pembatasan percobaan.
export const PIN_PASSWORD_PREFIX = 'mamam:';
export const pinToPassword = (pin) => `${PIN_PASSWORD_PREFIX}${pin}`;

/** owner@mail.com -> owner+staf@mail.com (Gmail: masuk ke kotak surat yang sama). */
export function staffEmailFrom(ownerEmail) {
  const [local, domain] = String(ownerEmail || '').trim().toLowerCase().split('@');
  if (!local || !domain) return '';
  return `${local.split('+')[0]}+staf@${domain}`;
}

/** cfg: { ownerEmail, staffEmail } */
export const emailForRole = (role, cfg) => (role === 'owner' ? cfg.ownerEmail : role === 'staff' ? cfg.staffEmail : '');
export function roleForEmail(email, cfg) {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return null;
  return ROLES.find((r) => emailForRole(r, cfg) === e) || null;
}

/** a***@gmail.com — supaya layar login tidak membeberkan email utuh. */
export function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!local || !domain) return '';
  return `${local[0]}${'*'.repeat(Math.max(2, Math.min(local.length - 1, 5)))}@${domain}`;
}

// ── Batas percobaan ─────────────────────────────────────────────────
export const initialAttempts = () => ({ fails: 0, lockedUntil: 0 });
export const isLocked = (st, now) => st.lockedUntil > now;
export const secondsLeft = (st, now) => Math.max(0, Math.ceil((st.lockedUntil - now) / 1000));
export const attemptsLeft = (st, rules = LOGIN_RULES) => Math.max(0, rules.max - st.fails);

/** Keadaan baru setelah satu percobaan. Selama terkunci, percobaan diabaikan. */
export function recordAttempt(st, ok, now, rules = LOGIN_RULES) {
  if (isLocked(st, now)) return st;
  if (ok) return initialAttempts();
  const fails = st.fails + 1;
  return fails >= rules.max ? { fails: 0, lockedUntil: now + rules.lockMs } : { fails, lockedUntil: 0 };
}

export function readAttempts(raw, now, rules = LOGIN_RULES) {
  try {
    const s = JSON.parse(raw);
    if (!s || !Number.isInteger(s.fails) || !Number.isFinite(s.lockedUntil)) return initialAttempts();
    if (s.fails < 0 || s.fails >= rules.max) return initialAttempts();
    // kunci yang janggal panjang (jam perangkat diutak-atik) dibuang
    if (s.lockedUntil > now + rules.lockMs * 2) return initialAttempts();
    return { fails: s.fails, lockedUntil: s.lockedUntil };
  } catch { return initialAttempts(); }
}

// ── Sesi ────────────────────────────────────────────────────────────
/** Lama sesi dari pengaturan (jam) -> ms, dibatasi 1 jam..30 hari; selain itu pakai bawaan. */
export function sessionMsFromHours(hours) {
  const h = Number(hours);
  return Number.isFinite(h) && h >= 1 && h <= 24 * 30 ? Math.round(h * HOUR_MS) : SESSION_MS;
}

export const makeSession = (role, now, ttlMs = SESSION_MS) => JSON.stringify({ role, at: now, ttl: ttlMs });

/** Peran dari sesi tersimpan, atau null (rusak / peran asing / kedaluwarsa / dari masa depan). */
export function readSession(raw, now) {
  try {
    const s = JSON.parse(raw);
    if (!s || !ROLES.includes(s.role) || !Number.isFinite(s.at)) return null;
    const ttl = Number.isFinite(s.ttl) && s.ttl >= HOUR_MS && s.ttl <= 30 * 24 * HOUR_MS ? s.ttl : SESSION_MS;
    if (now - s.at > ttl) return null;
    if (s.at > now + 60 * 1000) return null;
    return s.role;
  } catch { return null; }
}
