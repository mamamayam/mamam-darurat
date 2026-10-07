import { useEffect, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import NominalDock from './NominalDock';
import NominalCalculator from './NominalCalculator';
import {
  appendKey, backspaceDigits, toggleSign, parseNominal, toDigits, formatNominal,
} from './nominalMath';

/**
 * NominalKeypadSheet — keypad nominal (pengganti keyboard HP). Muncul menempel di
 * dasar layar seperti keyboard biasa (lihat NominalDock), bukan pop-up geser.
 * Layout dari "Preview: Nominal Keypad + Kalkulator Popup": layar angka +
 * ikon kalkulator, lalu 1-9 / 00 0 ⌫.
 *
 * Nilai di-commit LIVE ke pemanggil tiap tombol ditekan (seperti mengetik di
 * field biasa); tombol "Selesai" atau Back HP cuma menutup.
 *
 * Props:
 *   value, onChange(digits)  — string digit ('' | '0' | '12000' | '-500')
 *   title          string    — judul kecil di atas layar angka
 *   prefix/suffix  string    — 'Rp' / '%'
 *   allowNegative  boolean   — munculin tombol ± di sebelah ikon kalkulator
 *   calculator     boolean   — munculin ikon kalkulator (default true)
 *   max            number    — batas nilai (mis. 100 untuk persen)
 *   maxDigits      number
 *   hint(number)   function  — teks/elemen bantu di bawah layar angka
 *                              (mis. Kembalian di PaymentModal)
 *   onClose()
 */
const KEY = 'flex-1 h-14 short:h-11 rounded-[18px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xl short:text-lg font-bold text-slate-800 dark:text-slate-100 active:bg-slate-100 dark:active:bg-slate-800 select-none touch-manipulation';
const ICON_BTN = 'p-2 rounded-[10px] text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800 touch-manipulation';

export default function NominalKeypadSheet({
  value, onChange, title, prefix = 'Rp', suffix = '', allowNegative = false,
  calculator = true, max = null, maxDigits, hint, onClose,
}) {
  const digitsRef = useRef(toDigits(value));
  const [digits, setDigits] = useState(digitsRef.current);
  const [calcOpen, setCalcOpen] = useState(false);
  // Kalkulator dibiarkan terpasang setelah ditutup (supaya animasi keluar jalan); `key` baru
  // tiap dibuka = state hitungan segar dari nilai field saat ini.
  const [calcSession, setCalcSession] = useState(0);
  const openCalc = () => { setCalcSession((n) => n + 1); setCalcOpen(true); };

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const opts = { max, ...(maxDigits ? { maxDigits } : {}) };

  const commit = (next) => {
    if (next === digitsRef.current) return;
    digitsRef.current = next;
    setDigits(next);
    onChangeRef.current?.(next);
  };

  const press = (key) => commit(appendKey(digitsRef.current, key, opts));
  const backspace = () => commit(backspaceDigits(digitsRef.current));

  // Keyboard fisik (laptop/tablet): angka, Backspace, Enter = Selesai.
  // Mati selama kalkulator terbuka supaya ketikan tidak masuk dua tempat.
  useEffect(() => {
    if (calcOpen) return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); commit(appendKey(digitsRef.current, e.key, opts)); }
      else if (e.key === 'Backspace') { e.preventDefault(); commit(backspaceDigits(digitsRef.current)); }
      else if (e.key === 'Enter') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcOpen, max, maxDigits, onClose]);

  const number = parseNominal(digits);
  const empty = digits === '';

  return (
    <>
      <NominalDock onClose={onClose} hidden={calcOpen}>
        <div className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] max-h-[100dvh] overflow-y-auto">
         <div className="w-full max-w-md mx-auto">

          {title && (
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 truncate">{title}</div>
          )}

          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl pl-4 pr-2.5 py-3.5 mb-2">
            <div
              data-testid="nominal-display"
              className={`flex-1 text-xl font-extrabold overflow-x-auto whitespace-nowrap hide-scrollbar ${
                empty ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-slate-50'
              }`}
            >
              {formatNominal(number, { prefix, suffix })}
            </div>
            {allowNegative && (
              <button type="button" aria-label="Ganti plus/minus" onClick={() => commit(toggleSign(digitsRef.current))} className={ICON_BTN}>
                <span className="block w-5 text-center text-lg font-bold leading-5">±</span>
              </button>
            )}
            {calculator && (
              <button type="button" aria-label="Buka kalkulator" onClick={openCalc} className={ICON_BTN}>
                <Calculator className="w-5 h-5" />
              </button>
            )}
          </div>

          {hint && (
            <div className="px-1 mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">{hint(number)}</div>
          )}

          <div className="mt-3 short:mt-2 space-y-2 short:space-y-1.5">
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row) => (
              <div key={row[0]} className="flex gap-2.5">
                {row.map((k) => (
                  <button key={k} type="button" className={KEY} onClick={() => press(k)}>{k}</button>
                ))}
              </div>
            ))}
            <div className="flex gap-2.5">
              <button type="button" className={KEY} onClick={() => press('00')}>00</button>
              <button type="button" className={KEY} onClick={() => press('0')}>0</button>
              <button type="button" className={KEY} aria-label="Hapus" onClick={backspace}>⌫</button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 short:h-10 mt-3 rounded-2xl bg-accent-600 dark:bg-accent-500 text-white font-bold active:bg-accent-700 dark:active:bg-accent-600 touch-manipulation transition-colors"
          >
            Selesai
          </button>
         </div>
        </div>
      </NominalDock>

      {calcSession > 0 && (
        <NominalCalculator
          key={calcSession}
          open={calcOpen}
          initialDigits={digits}
          prefix={prefix}
          suffix={suffix}
          allowNegative={allowNegative}
          onClose={() => setCalcOpen(false)}
          onApply={(result) => { commit(result); setCalcOpen(false); }}
        />
      )}
    </>
  );
}
