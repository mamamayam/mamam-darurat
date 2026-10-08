import { useState } from 'react';
import { ShieldCheck, KeyRound, Mail } from 'lucide-react';
import { Card, Badge, Button, Select, Modal } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import PinPad from '../../auth/PinPad';
import { useAppContext } from '../../context/AppContext';
import { SESSION_HOURS_CHOICES } from '../../hook/useAppSettings';
import { MAX_ATTEMPTS } from '../../auth/authLogic';

/** Pengaturan login: status Supabase Auth, ganti PIN owner, reset PIN staf, lama sesi. */
export default function LoginSettings({ settings, saveSetting }) {
  const { authEnabled, ownerEmailMasked, staffEmailMasked, requestPinReset } = useAuth();
  const { triggerAlert, triggerConfirm } = useAppContext();
  const [pinSheet, setPinSheet] = useState(false);

  const onSession = async (e) => {
    try { await saveSetting('session_hours', Number(e.target.value)); } catch (err) { triggerAlert(err.message); }
  };

  const resetStaff = () => triggerConfirm(
    `Kirim link reset PIN Staf ke email ${staffEmailMasked}? Saat link dibuka, kamu keluar sementara untuk membuat PIN staf baru (harus beda dari PIN owner), lalu masuk lagi dengan PIN owner.`,
    async () => {
      const r = await requestPinReset('staff');
      triggerAlert(r.ok ? `Link reset terkirim ke ${r.sentTo}. Buka link itu di browser ini.` : r.message);
    },
  );

  return (
    <Card className="space-y-4" data-testid="login-settings">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent-600" /> Login</p>
        <span data-testid="auth-mode"><Badge variant={authEnabled ? 'success' : 'warning'}>{authEnabled ? 'Supabase Auth aktif' : 'Mode lama (PIN lokal)'}</Badge></span>
      </div>

      {!authEnabled && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Login masih memakai PIN lokal di <code>src/auth/pins.js</code>. Untuk memakai Supabase Auth, isi <code>VITE_AUTH_OWNER_EMAIL</code> lalu buat akunnya (langkah di <code>docs/auth-setup.md</code>).
        </p>
      )}

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Peran login</span><span className="font-bold text-slate-800 dark:text-slate-100">Owner &amp; Staf</span></div>
        {authEnabled && <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email pemulihan</span><span className="font-bold text-slate-800 dark:text-slate-100" data-testid="owner-email">{ownerEmailMasked}</span></div>}
        <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">Batas percobaan</span><span className="font-bold text-slate-800 dark:text-slate-100">{MAX_ATTEMPTS}x salah, dikunci 15 menit</span></div>
      </div>

      <Select label="Lama sesi login" value={String(settings.session_hours)} onChange={onSession} hint="Berlaku untuk login berikutnya.">
        {SESSION_HOURS_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        {!SESSION_HOURS_CHOICES.some((c) => c.value === settings.session_hours) && <option value={settings.session_hours}>{settings.session_hours} jam</option>}
      </Select>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={<KeyRound className="w-4 h-4" />} onClick={() => setPinSheet(true)} disabled={!authEnabled} data-testid="ganti-pin-owner">Ganti PIN Owner</Button>
        <Button variant="secondary" onClick={resetStaff} disabled={!authEnabled} data-testid="reset-pin-staf">Reset PIN Staf</Button>
      </div>

      {pinSheet && <ChangePinSheet onClose={() => setPinSheet(false)} />}
    </Card>
  );
}

function ChangePinSheet({ onClose }) {
  const { changeOwnPin } = useAuth();
  const { triggerAlert } = useAppContext();
  const [first, setFirst] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const onComplete = async (pin, reset) => {
    if (!first) { setFirst(pin); setMessage(''); reset(); return; }
    if (pin !== first) { setFirst(null); setMessage('PIN tidak sama. Ulangi dari awal.'); reset(); return; }
    setBusy(true);
    const r = await changeOwnPin(pin);
    setBusy(false);
    if (r.ok) { onClose(); triggerAlert('PIN owner diganti. Pakai PIN baru saat login berikutnya.'); return; }
    setFirst(null); setMessage(r.message); reset();
  };

  return (
    <Modal isOpen onClose={onClose} sheet size="md" maxHeight title="Ganti PIN Owner">
      <div className="p-5 pt-2 space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" data-testid="ganti-pin-sheet">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center" data-testid="ganti-pin-step">{first ? 'Ketik ulang PIN baru' : 'Masukkan 4 angka PIN baru'}</p>
        <PinPad key={first ? 'konfirmasi' : 'baru'} onComplete={onComplete} disabled={busy} />
        <p role="alert" className="h-5 text-sm font-semibold text-red-500 text-center">{message}</p>
      </div>
    </Modal>
  );
}
