import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useBackLayer from '../../hook/useBackLayer';
import { useNominalOpenClass } from './NominalOverlay';

/**
 * NominalDock — dasar keypad nominal yang muncul seperti keyboard HP biasa:
 * menempel di dasar layar, tanpa latar gelap, tanpa animasi geser, tanpa kartu
 * melayang. Halaman di belakangnya tetap kelihatan dan TIDAK tertutup: tinggi dock
 * diukur lalu dipasang ke CSS var `--kb-h`, dan aturan di index.css
 * (`html.nominal-dock`) memendekkan semua lapisan `fixed inset-0` (shell app, modal,
 * laci) sebesar itu + menyembunyikan navbar bawah — sama seperti keyboard HP
 * mendorong isi layar ke atas.
 *
 * Dock ditutup lewat tombol Selesai, tombol Back HP, atau saat kolom teks lain
 * difokuskan (supaya tidak bentrok dengan keyboard HP). Tidak ada tutup-lewat-ketuk-luar,
 * karena layar di belakang tetap harus bisa diketuk (mis. pindah ke kolom angka lain).
 *
 * `hidden` = disembunyikan sementara (mis. kalkulator sedang terbuka di atasnya),
 * state keypad tetap utuh.
 */
export default function NominalDock({ z = 'z-[110]', onClose, hidden = false, children }) {
  const ref = useRef(null);
  useBackLayer(true, onClose);
  useNominalOpenClass();

  useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el || hidden) return undefined;
    const apply = () => root.style.setProperty('--kb-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    root.classList.add('nominal-dock');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.classList.remove('nominal-dock');
      root.style.removeProperty('--kb-h');
    };
  }, [hidden]);

  useEffect(() => {
    const onFocusIn = (e) => {
      const t = e.target;
      if (ref.current?.contains(t)) return;
      if (t?.matches?.('input, textarea, select, [contenteditable="true"]')) onClose();
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={hidden ? { display: 'none' } : undefined}
      // Event React tetap merambat ke leluhur di pohon React (mis. backdrop Modal) walau DOM-nya di <body>.
      onClick={(e) => e.stopPropagation()}
      className={`fixed bottom-0 left-0 right-0 ${z}`}
    >
      {children}
    </div>,
    document.body,
  );
}
