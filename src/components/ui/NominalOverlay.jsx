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
export default function NominalOverlay({ z = 'z-[110]', onClose, children }) {
  useBackLayer(true, onClose);

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
