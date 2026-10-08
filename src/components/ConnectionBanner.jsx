import { useState, useEffect, useRef } from 'react';
import { WifiOff, CloudOff, Wifi, RefreshCw } from 'lucide-react';
import { useConnectionStatus, checkConnection } from '../lib/connection';
import { CONN_MESSAGES } from '../lib/connectionLogic';

/**
 * ConnectionBanner — pemberitahuan koneksi untuk SEMUA halaman.
 *  - tidak ada internet / server tidak terjangkau: bar peringatan + tombol "Coba lagi"
 *  - begitu pulih: bar hijau "Tersambung kembali" 4 detik + "Muat ulang" (untuk halaman yang tadi gagal memuat)
 * Di dalam aplikasi bar ini mengisi ruang di bawah header (tidak menutupi konten).
 * Di layar login (floating) bar menempel di atas layar.
 */
export default function ConnectionBanner({ floating = false }) {
  const status = useConnectionStatus();
  const [showBack, setShowBack] = useState(false);
  const [checking, setChecking] = useState(false);
  const prev = useRef(status);

  useEffect(() => {
    const wasDown = prev.current !== 'ok';
    prev.current = status;
    if (!(wasDown && status === 'ok')) return undefined;
    setShowBack(true);
    const id = setTimeout(() => setShowBack(false), 4000);
    return () => clearTimeout(id);
  }, [status]);

  if (status === 'ok' && !showBack) return null;

  const retry = async () => { setChecking(true); await checkConnection(); setChecking(false); };
  const down = status !== 'ok';
  const tone = !down
    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'
    : status === 'offline'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200'
      : 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200';
  const Icon = !down ? Wifi : status === 'offline' ? WifiOff : CloudOff;
  const text = !down ? CONN_MESSAGES.back : CONN_MESSAGES[status];

  return (
    <div role="status" aria-live="polite" data-testid="connection-banner" data-status={down ? status : 'back'}
      className={`${floating ? 'fixed top-0 inset-x-0 z-[120] pt-[max(0.5rem,env(safe-area-inset-top))] shadow-md' : 'shrink-0 py-2'} px-4 flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-300 ${tone}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">{text}</span>
      {down ? (
        <button type="button" onClick={retry} disabled={checking} data-testid="connection-retry"
          className="shrink-0 flex items-center gap-1 font-bold underline underline-offset-2 disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />{checking ? 'Memeriksa...' : 'Coba lagi'}
        </button>
      ) : (
        <button type="button" onClick={() => window.location.reload()} className="shrink-0 font-bold underline underline-offset-2">Muat ulang</button>
      )}
    </div>
  );
}
