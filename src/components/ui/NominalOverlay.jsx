import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import useBackLayer from '../../hook/useBackLayer';

/**
 * NominalOverlay — dasar bottom sheet untuk keypad nominal & kalkulator.
 *
 * Kenapa portal ke <body>: field angka dipakai di dalam Modal / CartDrawer /
 * PaymentModal. Kalau ada leluhur yang punya transform (laci geser, animasi
 * zoom), `position: fixed` anaknya jadi relatif ke leluhur itu, bukan layar —
 * sheet bisa kepotong atau salah posisi. Portal menghindari itu.
 *
 * Tombol Back HP menutup sheet ini dulu (useBackLayer), bukan layar di belakangnya.
 * Klik di dalam sheet di-stopPropagation karena event React tetap merambat ke
 * leluhur di pohon React walau DOM-nya di <body>.
 *
 * z-index: di atas PaymentModal (z-70) dan Modal 'top' (z-100), di bawah PIN (z-300).
 */
// Selama keypad/kalkulator terbuka, backdrop-blur layar di belakangnya dimatikan
// (kelas `nominal-open` di <html>, aturannya di index.css). Nilai di-commit LIVE,
// jadi tiap tombol bikin halaman di belakang re-render; kalau di belakangnya masih
// ada lapisan backdrop-blur (Modal, laci keranjang, header), browser harus nge-blur
// ulang SELURUH layar tiap ketukan -> layar kelip-kelip di HP kelas menengah.
// Hitung overlay yang terbuka supaya keypad + kalkulator bertumpuk tidak saling cabut.
let openOverlays = 0;

/** Tandai <html> sebagai "nominal-open" selama komponen ini terpasang (dipakai Overlay & Dock). */
export function useNominalOpenClass() {
  useEffect(() => {
    openOverlays += 1;
    document.documentElement.classList.add('nominal-open');
    return () => {
      openOverlays -= 1;
      if (openOverlays <= 0) {
        openOverlays = 0;
        document.documentElement.classList.remove('nominal-open');
      }
    };
  }, []);
}

export default function NominalOverlay({ z = 'z-[110]', onClose, children }) {
  useBackLayer(true, onClose);
  useNominalOpenClass();

  return createPortal(
    <div
      className={`fixed inset-0 ${z} flex items-end justify-center bg-black/45`}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nominal-sheet-up w-full max-w-md"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
