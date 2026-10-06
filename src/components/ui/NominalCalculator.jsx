import { useState } from 'react';
import NominalOverlay from './NominalOverlay';
import {
  calcInit, calcDigit, calcBackspace, calcOperator, calcEquals, calcPercent,
  calcClear, calcValue, calcIsEmpty, calcResult, calcExpression, formatNominal,
  parseNominal,
} from './nominalMath';

/**
 * NominalCalculator — popup kalkulator (4 operasi + %), dibuka dari ikon
 * kalkulator di keypad nominal. Palet gelap/oranye SENGAJA tetap (tidak ikut
 * tema aplikasi) supaya terasa sama dengan kalkulator bawaan HP — sesuai preview.
 *
 * Props:
 *   initialDigits  string   — nilai field saat ini; hitungan mulai dari sini
 *   prefix         string   — mis. 'Rp'
 *   suffix         string
 *   allowNegative  boolean  — kalau false, hasil minus tidak bisa dimasukkan
 *   onApply(digits)         — dipanggil dengan string digit hasil akhir
 *   onClose()
 */
const KEY = 'h-14 rounded-2xl text-xl font-medium bg-[#262626] text-[#ECECEC] active:bg-[#3A3A3C] select-none';
const OP = 'h-14 rounded-2xl text-xl font-semibold bg-[#262626] text-[#FF9F0A] active:bg-[#3A3A3C] select-none';

export default function NominalCalculator({ initialDigits, prefix = 'Rp', suffix = '', allowNegative = false, onApply, onClose }) {
  const [s, setS] = useState(() => calcInit(initialDigits));

  const fmt = (n) => formatNominal(n, { prefix, suffix });
  const empty = calcIsEmpty(s);
  const value = calcValue(s);

  // Yang akan dimasukkan = hasil setelah operasi menggantung dihitung.
  const resultDigits = calcResult(s);
  const resultNumber = parseNominal(resultDigits);
  const negativeBlocked = !allowNegative && resultNumber < 0;

  const digit = (k) => () => setS((cur) => calcDigit(cur, k));
  const op = (o) => () => setS((cur) => calcOperator(cur, o));

  return (
    <NominalOverlay z="z-[120]" onClose={onClose}>
      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <div className="bg-black rounded-3xl px-4 pt-[18px] pb-4">
        <div className="text-[13px] font-bold text-[#8E8E93] uppercase tracking-wider text-center mb-3">Kalkulator</div>

        <div className="text-right px-1 pb-3.5 mb-1 min-h-[50px]">
          <div className="text-[13px] font-semibold text-[#8E8E93] min-h-4">{calcExpression(s, fmt)}</div>
          <div
            className={`text-3xl font-medium overflow-x-auto whitespace-nowrap hide-scrollbar ${
              empty ? 'text-[#8E8E93]' : negativeBlocked ? 'text-red-400' : 'text-white'
            }`}
          >
            {empty ? fmt(0) : fmt(value)}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3.5">
          <button type="button" className={`${OP} col-span-2 !text-base tracking-wide`} onClick={() => setS(calcClear())}>AC</button>
          <button type="button" className={OP} onClick={() => setS((cur) => calcPercent(cur))}>%</button>
          <button type="button" className={OP} onClick={op('÷')}>÷</button>

          <button type="button" className={KEY} onClick={digit('7')}>7</button>
          <button type="button" className={KEY} onClick={digit('8')}>8</button>
          <button type="button" className={KEY} onClick={digit('9')}>9</button>
          <button type="button" className={OP} onClick={op('×')}>×</button>

          <button type="button" className={KEY} onClick={digit('4')}>4</button>
          <button type="button" className={KEY} onClick={digit('5')}>5</button>
          <button type="button" className={KEY} onClick={digit('6')}>6</button>
          <button type="button" className={OP} onClick={op('−')}>−</button>

          <button type="button" className={KEY} onClick={digit('1')}>1</button>
          <button type="button" className={KEY} onClick={digit('2')}>2</button>
          <button type="button" className={KEY} onClick={digit('3')}>3</button>
          <button type="button" className={OP} onClick={op('+')}>+</button>

          <button type="button" className={KEY} onClick={digit('00')}>00</button>
          <button type="button" className={KEY} onClick={digit('0')}>0</button>
          <button type="button" className={KEY} aria-label="Hapus" onClick={() => setS((cur) => calcBackspace(cur))}>⌫</button>
          <button type="button" className="h-14 rounded-2xl text-xl font-medium bg-[#FF9F0A] text-white active:bg-[#E08F09] select-none" onClick={() => setS((cur) => calcEquals(cur))}>=</button>
        </div>

        {negativeBlocked && (
          <p className="text-[11px] text-red-400 text-center mb-2">Hasilnya minus — field ini tidak menerima angka minus.</p>
        )}

        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className="flex-1 h-12 rounded-[14px] bg-[#1C1C1E] text-[#8E8E93] text-sm font-bold">Batal</button>
          <button
            type="button"
            disabled={negativeBlocked}
            onClick={() => onApply(resultDigits)}
            className="flex-1 h-12 rounded-[14px] bg-accent-600 dark:bg-accent-500 text-white text-sm font-bold disabled:opacity-40"
          >
            Masukkan
          </button>
        </div>
      </div>
      </div>
    </NominalOverlay>
  );
}
