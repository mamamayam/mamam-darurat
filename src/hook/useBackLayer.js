import { useEffect, useRef } from 'react';
import { backStack } from '../lib/backStack';

/**
 * useBackLayer(aktif, onBack)
 *
 * Selama `aktif` true, tombol Back browser/HP memanggil `onBack` (menutup
 * overlay ini) alih-alih keluar dari layar/aplikasi. Pasang di komponen
 * overlay: modal, laci, bottom sheet.
 *
 * Wajib dipanggil SEBELUM `if (!isOpen) return null` (aturan hooks).
 * `onBack` tidak perlu di-memoize; versi terbaru selalu dipakai.
 */
export default function useBackLayer(active, onBack) {
  const latest = useRef(onBack);
  useEffect(() => { latest.current = onBack; });

  useEffect(() => {
    if (!active) return undefined;
    const id = backStack.register(() => latest.current?.());
    return () => backStack.unregister(id);
  }, [active]);
}
