import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from './AuthContext';
import { roleLabel } from './permissions';
import PinPad from './PinPad';
import { Button } from '../components/ui';

/** Muncul saat aplikasi dibuka dari tautan "Lupa PIN" di email: buat PIN baru (2x ketik). */
export default function ResetPinScreen() {
  const { recovery, completeRecovery, cancelRecovery } = useAuth();
  const [first, setFirst] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const onComplete = async (pin, reset) => {
    if (!first) { setFirst(pin); setMessage(''); reset(); return; }
    if (pin !== first) { setFirst(null); setMessage('PIN tidak sama. Ulangi dari awal.'); reset(); return; }
    setBusy(true);
    const r = await completeRecovery(pin);        // sukses: layar ini hilang, kembali ke login
    setBusy(false);
    if (!r.ok) { setFirst(null); setMessage(r.message); reset(); }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto flex flex-col items-center justify-center gap-7 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-6" data-testid="reset-pin-screen">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-accent-600 to-accent-500 flex items-center justify-center shadow-md"><KeyRound className="w-6 h-6 text-white" /></div>
        <h1 className="font-heading font-bold text-2xl">Buat PIN baru{recovery?.role ? ` ${roleLabel(recovery.role)}` : ''}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1" data-testid="reset-step">{first ? 'Ketik ulang PIN baru' : 'Masukkan 4 angka PIN baru'}</p>
      </div>

      <PinPad key={first ? 'konfirmasi' : 'baru'} onComplete={onComplete} disabled={busy} />

      <p role="alert" className="h-5 text-sm font-semibold text-red-500 text-center" data-testid="reset-message">{message}</p>
      <Button variant="ghost" onClick={cancelRecovery} disabled={busy}>Batal</Button>
    </div>
  );
}
