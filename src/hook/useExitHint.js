import { useSyncExternalStore } from 'react';
import { backStack } from '../lib/backStack';

/**
 * useExitHint() → true selama notif "ketuk lagi untuk keluar" harus tampil.
 * Menyala saat pengguna menekan Back di Beranda; padam sendiri kalau tidak ada Back kedua.
 */
export default function useExitHint() {
  return useSyncExternalStore(
    backStack.subscribeExitHint,
    backStack.getExitHint,
    () => false,
  );
}
