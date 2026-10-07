import { useState, useEffect, useCallback } from 'react';
import { Delete, Lock } from 'lucide-react';
import { useAuth } from './AuthContext';
import { isLocked, secondsLeft, attemptsLeft } from './authLogic';
import { versionLabel } from '../lib/appVersion';

/** Layar PIN 4 digit. Otomatis masuk saat digit ke-4 diisi. */
export default function LoginScreen() {
  const { login, attempts } = useAuth();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());

  const locked = isLocked(attempts, now);

  // detak tiap 0,5 detik hanya selama terkunci (untuk hitung mundur)
  useEffect(() => {
    if (!locked) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [locked]);

  const submit = useCallback((value) => {
    const r = login(value);
    setPin('');
    if (r.ok) return;
    setNow(Date.now());
    setMessage(r.locked
      ? `Terlalu banyak percobaan salah. Coba lagi dalam ${r.secondsLeft} detik.`
      : `PIN salah. Sisa percobaan ${r.attemptsLeft}.`);
  }, [login]);

  const press = useCallback((d) => {
    if (isLocked(attempts, Date.now())) return;
    setMessage('');
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) setTimeout(() => submit(next), 120);   // jeda singkat supaya titik ke-4 sempat tampil
      return next;
    });
  }, [attempts, submit]);

  const back = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  // keyboard fisik (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, back]);

  const lockedMsg = locked ? `Terkunci. Coba lagi dalam ${secondsLeft(attempts, now)} detik.` : '';
  const shown = locked ? lockedMsg : message;

  return (
    <div className="fixed inset-0 overflow-y-auto flex flex-col items-center justify-center gap-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-6" data-testid="login-screen">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-accent-600 to-accent-500 flex items-center justify-center shadow-md"><Lock className="w-6 h-6 text-white" /></div>
        <h1 className="font-heading font-bold text-2xl">Mamam Darurat</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Masukkan PIN</p>
      </div>

      <div className="flex gap-4" aria-label="PIN" data-testid="pin-dots" data-filled={pin.length}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${i < pin.length ? 'bg-accent-600 border-accent-600 scale-110' : 'border-slate-300 dark:border-slate-600'}`} />
        ))}
      </div>

      <p role="alert" data-testid="login-message" className={`h-5 text-sm font-semibold text-center ${shown ? 'text-red-500' : ''}`}>{shown}</p>

      <div className="grid grid-cols-3 gap-3 w-64">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={locked}
            className="h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xl font-bold shadow-sm active:scale-95 disabled:opacity-40 transition-all">{d}</button>
        ))}
        <span />
        <button onClick={() => press('0')} disabled={locked}
          className="h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xl font-bold shadow-sm active:scale-95 disabled:opacity-40 transition-all">0</button>
        <button onClick={back} disabled={locked} aria-label="Hapus"
          className="h-14 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 disabled:opacity-40 transition-all"><Delete className="w-6 h-6" /></button>
      </div>

      <p className="text-[11px] text-slate-300 dark:text-slate-600" data-testid="app-version">{versionLabel()}</p>
    </div>
  );
}
