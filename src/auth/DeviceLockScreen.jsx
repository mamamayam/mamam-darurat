import { Lock, WifiOff } from 'lucide-react';
import { Button } from '../components/ui';
import { STATUS } from '../hook/deviceLogic';

const COPY = {
  [STATUS.PENDING]: { title: 'Perangkat belum terdaftar', body: 'Minta owner mendaftarkan HP ini di Pengaturan, Perangkat. Setelah itu app bisa dipakai.', code: true },
  [STATUS.REVOKED]: { title: 'Akses perangkat dicabut', body: 'Owner mencabut akses HP ini. Minta owner mendaftarkannya lagi di Pengaturan, Perangkat.', code: true },
  [STATUS.FAILED]: { title: 'Perangkat belum bisa dicek', body: 'Tidak bisa terhubung ke server. Cek internet lalu coba lagi.', code: false },
};

/** Layar kunci HP staf yang belum didaftarkan owner (atau yang aksesnya dicabut). */
export default function DeviceLockScreen({ status, code, onRetry, onLogout }) {
  const c = COPY[status] || COPY[STATUS.PENDING];
  const Icon = status === STATUS.FAILED ? WifiOff : Lock;
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" data-testid="device-lock">
      <span className="w-14 h-14 rounded-full bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 flex items-center justify-center"><Icon className="w-7 h-7" /></span>
      <div className="space-y-1.5 max-w-xs">
        <p className="font-heading font-bold text-lg" data-testid="device-lock-title">{c.title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{c.body}</p>
      </div>
      {c.code && (
        <span className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-1.5 font-mono text-sm font-bold tracking-widest" data-testid="device-code">{code}</span>
      )}
      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        <Button variant="secondary" size="full" onClick={onRetry}>Cek lagi</Button>
        <Button variant="secondary" size="full" onClick={onLogout}>Keluar</Button>
      </div>
    </div>
  );
}
