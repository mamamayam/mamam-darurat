import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useExitHint from '../../hook/useExitHint';

/**
 * Notif mengambang "Ketuk lagi untuk keluar".
 * Tampil saat pengguna menekan Back di Beranda; hilang sendiri kalau tidak ada Back kedua
 * (waktunya diatur backStack). Dipasang sekali di main.jsx supaya juga muncul di layar PIN.
 * Tidak menangkap sentuhan (pointer-events-none) dan berada di atas modal.
 */
export default function ExitToast() {
  const show = useExitHint();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="exit-toast"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-x-0 z-[400] flex justify-center px-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] short:bottom-[calc(4rem+env(safe-area-inset-bottom))]"
        >
          <div className="rounded-full bg-slate-900/95 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
            Ketuk lagi untuk keluar
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
