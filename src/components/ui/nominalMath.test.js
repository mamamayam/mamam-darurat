import { describe, it, expect } from 'vitest';
import {
  appendKey, backspaceDigits, toggleSign, parseNominal, toDigits,
  formatGrouped, formatNominal, applyOp, MAX_DIGITS,
  calcInit, calcDigit, calcBackspace, calcOperator, calcEquals, calcPercent,
  calcResult, calcValue, calcIsEmpty, calcExpression,
} from './nominalMath';

const type = (keys, start = '') => keys.reduce((cur, k) => appendKey(cur, k), start);

describe('appendKey', () => {
  it('mengetik digit biasa', () => {
    expect(type(['1', '2', '5'])).toBe('125');
  });
  it('"00" diabaikan di field kosong atau "0", normal setelah ada angka', () => {
    expect(appendKey('', '00')).toBe('');
    expect(appendKey('0', '00')).toBe('0');
    expect(appendKey('5', '00')).toBe('500');
  });
  it('"0" di field kosong jadi "0" (nol eksplisit), lalu digit berikutnya menggantikan', () => {
    expect(appendKey('', '0')).toBe('0');
    expect(appendKey('0', '7')).toBe('7');
    expect(appendKey('0', '0')).toBe('0');
  });
  it('berhenti di batas digit', () => {
    const full = '9'.repeat(MAX_DIGITS);
    expect(appendKey(full, '1')).toBe(full);
    expect(appendKey('9'.repeat(MAX_DIGITS - 1), '00')).toBe('9'.repeat(MAX_DIGITS - 1));
  });
  it('menghormati batas nilai max (mis. persen ≤ 100)', () => {
    expect(appendKey('10', '0', { max: 100 })).toBe('100');
    expect(appendKey('100', '0', { max: 100 })).toBe('100');
    expect(appendKey('9', '9', { max: 100 })).toBe('99');
    expect(appendKey('99', '9', { max: 100 })).toBe('99');
  });
  it('menjaga tanda minus', () => {
    expect(appendKey('-5', '0')).toBe('-50');
    expect(appendKey('-5', '00')).toBe('-500');
  });
});

describe('backspaceDigits / toggleSign', () => {
  it('hapus satu digit; kosong tetap kosong', () => {
    expect(backspaceDigits('125')).toBe('12');
    expect(backspaceDigits('')).toBe('');
    expect(backspaceDigits('5')).toBe('');
  });
  it('minus sisa tanda doang dibersihkan', () => {
    expect(backspaceDigits('-5')).toBe('');
    expect(backspaceDigits('-52')).toBe('-5');
  });
  it('toggleSign balik tanda, nol & kosong dibiarkan', () => {
    expect(toggleSign('5000')).toBe('-5000');
    expect(toggleSign('-5000')).toBe('5000');
    expect(toggleSign('')).toBe('');
    expect(toggleSign('0')).toBe('0');
  });
});

describe('parse & format', () => {
  it('parseNominal', () => {
    expect(parseNominal('')).toBe(0);
    expect(parseNominal('-')).toBe(0);
    expect(parseNominal('-5000')).toBe(-5000);
    expect(parseNominal('12000')).toBe(12000);
  });
  it('toDigits menormalkan nilai dari luar', () => {
    expect(toDigits('')).toBe('');
    expect(toDigits(null)).toBe('');
    expect(toDigits(undefined)).toBe('');
    expect(toDigits(0)).toBe('0');
    expect(toDigits('15000')).toBe('15000');
    expect(toDigits(15000)).toBe('15000');
    expect(toDigits('abc')).toBe('');
  });
  it('format titik ribuan id-ID, tanda minus di depan prefix', () => {
    expect(formatGrouped(12000)).toBe('12.000');
    expect(formatGrouped(-5000)).toBe('-5.000');
    expect(formatNominal(12000, { prefix: 'Rp' })).toBe('Rp12.000');
    expect(formatNominal(-5000, { prefix: 'Rp' })).toBe('-Rp5.000');
    expect(formatNominal(10, { suffix: '%' })).toBe('10%');
  });
});

describe('applyOp', () => {
  it('empat operasi dasar', () => {
    expect(applyOp('+', 2, 3)).toBe(5);
    expect(applyOp('−', 2, 3)).toBe(-1);
    expect(applyOp('×', 4, 3)).toBe(12);
    expect(applyOp('÷', 10, 3)).toBe(3);
  });
  it('bagi nol mempertahankan nilai lama', () => {
    expect(applyOp('÷', 10, 0)).toBe(10);
  });
  it('overflow mempertahankan nilai lama', () => {
    expect(applyOp('×', 999999999999, 999999999999)).toBe(999999999999);
  });
});

describe('kalkulator', () => {
  const press = (state, seq) => seq.reduce((s, step) => {
    if (step === '=') return calcEquals(s);
    if (step === '%') return calcPercent(s);
    if (step === '⌫') return calcBackspace(s);
    if (['+', '−', '×', '÷'].includes(step)) return calcOperator(s, step);
    return calcDigit(s, step);
  }, state);

  it('mulai dari nominal yang sudah ada di form', () => {
    const s = calcInit('50000');
    expect(calcValue(s)).toBe(50000);
    expect(calcIsEmpty(s)).toBe(false);
    expect(calcIsEmpty(calcInit(''))).toBe(true);
  });
  it('tambah dari nilai awal: 50000 + 2500 =', () => {
    const s = press(calcInit('50000'), ['+', '2', '5', '00', '=']);
    expect(calcValue(s)).toBe(52500);
    expect(s.done).toBe(true);
  });
  it('chaining tanpa "=": 5 + 3 × 2 =  (kiri ke kanan, kayak kalkulator HP)', () => {
    const s = press(calcInit(), ['5', '+', '3', '×', '2', '=']);
    expect(calcValue(s)).toBe(16);
  });
  it('ganti operator sebelum ngetik angka kedua', () => {
    const s = press(calcInit(), ['5', '+', '−', '2', '=']);
    expect(calcValue(s)).toBe(3);
  });
  it('mengetik angka setelah "=" mulai hitungan baru; operator melanjutkan hasil', () => {
    const done = press(calcInit(), ['5', '+', '3', '=']);
    expect(calcValue(press(done, ['9']))).toBe(9);
    expect(calcValue(press(done, ['×', '2', '=']))).toBe(16);
  });
  it('hasil negatif didukung', () => {
    const s = press(calcInit(), ['3', '−', '5', '=']);
    expect(calcValue(s)).toBe(-2);
  });
  it('% setelah operator: 50000 − 10% = 45000', () => {
    const s = press(calcInit('50000'), ['−', '1', '0', '%']);
    expect(calcValue(s)).toBe(45000);
  });
  it('% setelah +: 50000 + 10% = 55000', () => {
    const s = press(calcInit('50000'), ['+', '1', '0', '%']);
    expect(calcValue(s)).toBe(55000);
  });
  it('% setelah ×: 200 × 10% = 20 (dibenerin dari preview)', () => {
    const s = press(calcInit('200'), ['×', '1', '0', '%']);
    expect(calcValue(s)).toBe(20);
  });
  it('% setelah ÷: 200 ÷ 10% = 2000', () => {
    const s = press(calcInit('200'), ['÷', '1', '0', '%']);
    expect(calcValue(s)).toBe(2000);
  });
  it('% berdiri sendiri: per-100-nya', () => {
    const s = press(calcInit('5000'), ['%']);
    expect(s.input).toBe('50');
  });
  it('backspace hanya menghapus yang lagi diketik', () => {
    const s = press(calcInit(), ['1', '2', '3', '⌫']);
    expect(s.input).toBe('12');
  });
  it('expression line', () => {
    const s = press(calcInit('50000'), ['−']);
    expect(calcExpression(s, (n) => `Rp${n}`)).toBe('Rp50000 −');
    expect(calcExpression(calcInit('5'), (n) => `Rp${n}`)).toBe('');
  });
});

describe('calcResult (tombol Masukkan)', () => {
  it('belum ngetik apa-apa → string kosong', () => {
    expect(calcResult(calcInit())).toBe('');
  });
  it('hanya angka → angka itu', () => {
    expect(calcResult(calcInit('12000'))).toBe('12000');
  });
  it('operasi menggantung dihitung dulu: 50000 + 2000 (tanpa "=") → 52000', () => {
    const s = calcDigit(calcOperator(calcInit('50000'), '+'), '2');
    const s2 = calcDigit(calcDigit(calcDigit(s, '0'), '0'), '0');
    expect(calcResult(s2)).toBe('52000');
  });
  it('operator tanpa angka kedua → nilai sebelum operator', () => {
    expect(calcResult(calcOperator(calcInit('5000'), '+'))).toBe('5000');
  });
  it('nol eksplisit tetap "0"', () => {
    expect(calcResult(calcInit('0'))).toBe('0');
  });
  it('hasil negatif dikembalikan apa adanya (pemanggil yang memutuskan boleh/tidak)', () => {
    const s = calcEquals(calcDigit(calcOperator(calcInit('3'), '−'), '5'));
    expect(calcResult(s)).toBe('-2');
  });
});
