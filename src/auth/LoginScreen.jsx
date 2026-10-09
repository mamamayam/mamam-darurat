import { useState, useEffect } from 'react';
import { Lock, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { isLocked, secondsLeft, MAX_ATTEMPTS } from './authLogic';
import PinPad from './PinPad';
import { Modal, Button } from '../components/ui';
import ConnectionBanner from '../components/ConnectionBanner';
import { versionLabel } from '../lib/appVersion';

const fmtLock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Layar PIN 4 digit. Otomatis masuk saat digit ke-4 diisi. 3x salah = dikunci + Lupa PIN. */
export default function LoginScreen() {
  const { login, attempts, notice, clearNotice } = useAuth();
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const locked = isLocked(attempts, now);

  // detak tiap 0,5 detik hanya selama terkunci (untuk hitung mundur)
  useEffect(() => {
    if (!locked) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [locked]);

  const submit = async (value, reset) => {
    clearNotice();
    setBusy(true);
    const r = await login(value);
    setBusy(false);
    reset();
    setNow(Date.now());
    if (r.ok) return;
    if (r.networkError) { setMessage(r.networkError); return; }
    if (r.locked) { setMessage(''); setForgotOpen(true); return; }     // percobaan ke-3 salah: langsung tawarkan Lupa PIN
    setMessage(`PIN salah. Sisa percobaan ${r.attemptsLeft}.`);
  };

  const shown = locked ? `PIN salah ${MAX_ATTEMPTS}x. Dikunci, coba lagi dalam ${fmtLock(secondsLeft(attempts, now))}.` : message;

  return (
    <div className="fixed inset-0 overflow-y-auto flex flex-col items-center justify-center gap-7 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-6" data-testid="login-screen">
      <ConnectionBanner floating />
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-accent-600 to-accent-500 flex items-center justify-center shadow-md"><Lock className="w-6 h-6 text-white" /></div>
        <h1 className="font-heading font-bold text-2xl">Mamam POS</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Masukkan PIN</p>
      </div>

      <PinPad onComplete={submit} disabled={locked || busy || forgotOpen} />

      <div className="text-center space-y-2 min-h-[3.25rem]">
        <p role="alert" data-testid="login-message" className={`text-sm font-semibold ${shown ? 'text-red-500' : notice ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{shown || notice}</p>
        <button type="button" onClick={() => setForgotOpen(true)} data-testid="lupa-pin"
          className={`text-xs font-bold ${locked ? 'text-accent-600 dark:text-accent-400 underline' : 'text-slate-400 dark:text-slate-500'}`}>Lupa PIN?</button>
      </div>

      <p className="text-xs text-slate-300 dark:text-slate-600" data-testid="app-version">{versionLabel()}</p>

      <ForgotPinSheet isOpen={forgotOpen} onClose={() => setForgotOpen(false)} locked={locked} />
    </div>
  );
}

function ForgotPinSheet({ isOpen, onClose, locked }) {
  const { authEnabled, requestPinReset, ownerEmailMasked, staffEmailMasked } = useAuth();
  const [target, setTarget] = useState('owner');
  const [state, setState] = useState({ status: 'idle', message: '', sentTo: '' });

  useEffect(() => { if (!isOpen) setState({ status: 'idle', message: '', sentTo: '' }); }, [isOpen]);

  const send = async () => {
    setState({ status: 'sending', message: '', sentTo: '' });
    const r = await requestPinReset(target);
    setState(r.ok ? { status: 'sent', message: '', sentTo: r.sentTo } : { status: 'error', message: r.message, sentTo: '' });
  };

  const toMasked = target === 'owner' ? ownerEmailMasked : staffEmailMasked;
  return (
    <Modal isOpen={isOpen} onClose={onClose} sheet size="md" maxHeight title="Lupa PIN">
      <div className="p-5 pt-2 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]" data-testid="lupa-pin-sheet">
        {locked && <p className="text-sm font-semibold text-red-500">PIN salah {MAX_ATTEMPTS} kali, login dikunci 15 menit.</p>}

        {!authEnabled ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Reset lewat email belum aktif karena login Supabase belum disambungkan. Kunci terbuka sendiri setelah 15 menit.
            Untuk mengganti PIN sekarang, ubah <code className="text-xs">src/auth/pins.js</code> atau aktifkan login Supabase (lihat <code className="text-xs">docs/auth-setup.md</code>).
          </p>
        ) : state.status === 'sent' ? (
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-4 space-y-1" data-testid="reset-terkirim">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Link reset terkirim</p>
            <p className="text-sm text-emerald-800/90 dark:text-emerald-200/90">Cek email <b>{state.sentTo}</b> (cek juga folder Spam), lalu ketuk link di dalamnya dari HP/browser ini. Kamu akan diminta membuat PIN baru.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">PIN siapa yang lupa? Link untuk membuat PIN baru dikirim ke email owner.</p>
            <div className="grid grid-cols-2 gap-2">
              {[['owner', 'Owner'], ['staff', 'Staf']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setTarget(v)} data-testid={`lupa-${v}`}
                  className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${target === v ? 'border-accent-600 bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>{l}</button>
              ))}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" /> Dikirim ke {toMasked || 'email owner'}</p>
            {state.status === 'error' && <p className="text-sm font-semibold text-red-500" role="alert">{state.message}</p>}
            <Button size="full" onClick={send} disabled={state.status === 'sending'} data-testid="kirim-reset">{state.status === 'sending' ? 'Mengirim...' : 'Kirim link reset'}</Button>
          </>
        )}

        <Button size="full" variant="ghost" onClick={onClose}>Tutup</Button>
      </div>
    </Modal>
  );
}
