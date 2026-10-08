import { useState, useEffect, useCallback, useRef } from 'react';
import { Delete } from 'lucide-react';

/**
 * PinPad — titik PIN 4 digit + keypad angka (+ keyboard fisik). Dipakai layar
 * login, buat PIN baru, dan PIN karyawan.
 *
 * Saat digit ke-4 terisi, `onComplete(pin, reset)` dipanggil SEKALI dan input
 * dikunci sampai `reset()` dipanggil (supaya tidak terkirim ganda saat menunggu
 * jawaban server). `reset()` mengosongkan titik dan membuka kunci.
 */
export default function PinPad({ onComplete, disabled = false, listenKeyboard = true }) {
  const [pin, setPin] = useState('');
  const pinRef = useRef('');
  const waitingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const doneRef = useRef(onComplete);
  useEffect(() => { disabledRef.current = disabled; doneRef.current = onComplete; });

  const reset = useCallback(() => { pinRef.current = ''; waitingRef.current = false; setPin(''); }, []);

  const press = useCallback((d) => {
    if (disabledRef.current || waitingRef.current || pinRef.current.length >= 4) return;
    pinRef.current += d;
    setPin(pinRef.current);
    if (pinRef.current.length === 4) {
      waitingRef.current = true;
      const value = pinRef.current;
      setTimeout(() => doneRef.current?.(value, reset), 120);   // jeda singkat supaya titik ke-4 sempat tampil
    }
  }, [reset]);

  const back = useCallback(() => {
    if (disabledRef.current || waitingRef.current) return;
    pinRef.current = pinRef.current.slice(0, -1);
    setPin(pinRef.current);
  }, []);

  useEffect(() => {
    if (!listenKeyboard) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, back, listenKeyboard]);

  const keyCls = 'h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xl font-bold shadow-sm active:scale-95 disabled:opacity-40 transition-all';
  return (
    <>
      <div className="flex gap-4 justify-center" aria-label="PIN" data-testid="pin-dots" data-filled={pin.length}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${i < pin.length ? 'bg-accent-600 border-accent-600 scale-110' : 'border-slate-300 dark:border-slate-600'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-64 mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={disabled} className={keyCls}>{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} disabled={disabled} className={keyCls}>0</button>
        <button type="button" onClick={back} disabled={disabled} aria-label="Hapus"
          className="h-14 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 disabled:opacity-40 transition-all"><Delete className="w-6 h-6" /></button>
      </div>
    </>
  );
}
