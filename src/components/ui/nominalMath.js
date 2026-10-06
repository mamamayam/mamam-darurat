/**
 * nominalMath — logika murni keypad nominal + kalkulator popup (tanpa React).
 * Di-port dari "Preview: Nominal Keypad + Kalkulator Popup", dipisah dari UI
 * supaya bisa dites.
 *
 * Nilai disimpan sebagai STRING digit ('' = kosong, '0' = nol yang diketik
 * sengaja, '-5000' = negatif) — sama seperti nilai <input type="number">
 * yang dipakai form-form lama, jadi state di pemanggil gak perlu berubah.
 *
 * Beda dari preview (disengaja):
 *  - '0' di field kosong sekarang jadi '0' (bukan diabaikan), karena beberapa
 *    form (Saldo Aktual, Saldo Awal) membedakan "kosong" dari "0".
 *  - Tombol Masukkan menghitung dulu operasi yang belum ditekan "=".
 *  - % untuk × dan ÷ dibenerin (preview: 200 × 10% = 4.000, seharusnya 20).
 *  - Dukungan angka negatif (toggleSign) buat field yang memang boleh minus.
 */

export const MAX_DIGITS = 12;
export const MAX_VALUE = 10 ** MAX_DIGITS - 1;

const splitSign = (s) => (s.startsWith('-') ? ['-', s.slice(1)] : ['', s]);
const withinRange = (n) => Math.abs(n) <= MAX_VALUE;

// ── Digit entry ──────────────────────────────────────────────────────────────

/**
 * Tambah satu tombol ('0'-'9' atau '00') ke nilai sekarang.
 * opts.maxDigits — batas panjang digit; opts.max — batas nilai (mis. 100 untuk %).
 */
export function appendKey(current, key, { maxDigits = MAX_DIGITS, max = null } = {}) {
  const [sign, body] = splitSign(current);
  if (key === '00' && (body === '' || body === '0')) return current;
  const next = body === '0' ? key : body + key;
  if (next.length > maxDigits) return current;
  if (max !== null && Number(next) > max) return current;
  return (next === '0' ? '' : sign) + next;
}

export function backspaceDigits(current) {
  if (current === '') return current;
  const next = current.slice(0, -1);
  return next === '-' ? '' : next;
}

/** Balik tanda +/−. Kosong dan nol dibiarkan (nol gak punya tanda). */
export function toggleSign(current) {
  if (current === '' || current === '0') return current;
  return current.startsWith('-') ? current.slice(1) : `-${current}`;
}

// ── Parsing & formatting ─────────────────────────────────────────────────────

export function parseNominal(s) {
  if (s === '' || s === '-' || s == null) return 0;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Normalisasi nilai dari luar (string/number/null) jadi string digit. */
export function toDigits(value) {
  if (value === '' || value == null) return '';
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? String(n) : '';
}

const groupFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** 12000 → "12.000", -5000 → "-5.000" (tanda di depan, bukan di antara prefix & angka). */
export function formatGrouped(n) {
  return `${n < 0 ? '-' : ''}${groupFmt.format(Math.abs(n))}`;
}

/** formatNominal(-5000, { prefix: 'Rp' }) → "-Rp5.000" */
export function formatNominal(n, { prefix = '', suffix = '' } = {}) {
  return `${n < 0 ? '-' : ''}${prefix}${groupFmt.format(Math.abs(n))}${suffix}`;
}

// ── Kalkulator ───────────────────────────────────────────────────────────────

export function applyOp(op, a, b) {
  let r;
  switch (op) {
    case '+': r = a + b; break;
    case '−': r = a - b; break;
    case '×': r = a * b; break;
    case '÷': r = b === 0 ? a : Math.trunc(a / b); break;
    default: r = b;
  }
  return withinRange(r) ? r : a; // overflow → abaikan, nilai lama dipertahankan
}

export const calcInit = (digits = '') => ({ input: digits, acc: null, op: null, done: false });

export const calcIsEmpty = (s) => s.input === '' && s.acc === null;

export const calcValue = (s) => (s.input !== '' ? parseNominal(s.input) : (s.acc ?? 0));

export function calcDigit(s, key, opts) {
  const base = s.done ? calcInit() : s;
  return { ...base, input: appendKey(base.input, key, opts) };
}

export const calcBackspace = (s) => ({ ...s, input: backspaceDigits(s.input) });

export const calcClear = () => calcInit();

export function calcOperator(s, op) {
  const value = calcValue(s);
  let acc = s.acc;
  if (acc === null) acc = value;
  else if (s.input !== '') acc = applyOp(s.op, acc, value);
  return { input: '', acc, op, done: false };
}

export function calcEquals(s) {
  if (s.op === null) return s;
  const acc = applyOp(s.op, s.acc ?? 0, calcValue(s));
  return { input: '', acc, op: null, done: true };
}

export function calcPercent(s) {
  if (s.op !== null && s.input !== '') {
    // "50000 − 10%" → 10% DARI 50000, langsung dihitung seperti "="
    const base = s.acc ?? 0;
    const pct = parseNominal(s.input);
    let result;
    if (s.op === '+' || s.op === '−') result = applyOp(s.op, base, Math.round((base * pct) / 100));
    else if (s.op === '×') result = Math.round((base * pct) / 100);
    else result = pct === 0 ? base : Math.trunc((base * 100) / pct);
    return { input: '', acc: withinRange(result) ? result : base, op: null, done: true };
  }
  // Berdiri sendiri: ubah angka jadi per-100-nya
  return { input: String(Math.round(calcValue(s) / 100)), acc: null, op: null, done: false };
}

/** Teks baris ekspresi kecil di atas angka, mis. "Rp50.000 −". */
export function calcExpression(s, fmt) {
  return s.op !== null ? `${fmt(s.acc ?? 0)} ${s.op}` : '';
}

/**
 * Hasil akhir yang dimasukkan ke field saat tekan "Masukkan":
 * operasi yang menggantung dihitung dulu; kalau belum ada yang diketik → ''.
 */
export function calcResult(s) {
  if (calcIsEmpty(s)) return '';
  const settled = s.op !== null && s.input !== '' ? calcEquals(s) : s;
  return String(calcValue(settled));
}
