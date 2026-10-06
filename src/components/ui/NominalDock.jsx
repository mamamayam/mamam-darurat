import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useBackLayer from '../../hook/useBackLayer';
import { useNominalOpenClass } from './NominalOverlay';

/**
 * NominalDock — dasar keypad nominal yang muncul seperti keyboard HP biasa:
 * menempel di dasar layar, tanpa latar gelap, tanpa kartu melayang.
 *
 * Halaman di belakangnya tetap kelihatan dan TIDAK tertutup: tinggi dock diukur lalu
 * dipasang ke CSS var `--kb-h`, dan aturan di index.css (`html.nominal-dock`)
 * memendekkan semua lapisan `fixed inset-0` (shell app, modal, laci) sebesar itu —
 * sama seperti keyboard HP mendorong isi layar ke atas.
 *
 * ANIMASI (mirip keyboard HP): `--kb-h` adalah custom property terdaftar (@property)
 * yang di-transisi di <html>, jadi layar naik/turun mulus; dock sendiri meluncur
 * naik (keyframes `nominal-dock-in`). Saat ditutup, dock tidak langsung hilang:
 * salinannya (ghost) meluncur turun sementara layar turun lagi. Pindah dari satu
 * kolom angka ke kolom angka lain TIDAK memicu animasi (dock sama, cuma ganti pemilik).
 *
 * Dock ditutup lewat tombol Selesai, tombol Back HP, atau saat kolom teks lain
 * difokuskan (supaya tidak bentrok dengan keyboard HP). Tidak ada tutup-lewat-ketuk-luar,
 * karena layar di belakang tetap harus bisa diketuk (mis. pindah ke kolom angka lain).
 *
 * `hidden` = disembunyikan sementara (mis. kalkulator sedang terbuka di atasnya),
 * state keypad tetap utuh.
 */
export const DOCK_MS = 280;

let dockCount = 0;       // jumlah dock yang sedang terpasang
let pendingExit = false; // dock baru saja dicabut; tunggu apakah ada penggantinya (commit yang sama)

function finishExit(ghost) {
  const root = document.documentElement;
  if (ghost) {
    ghost.classList.remove('nominal-dock-in');
    ghost.classList.add('nominal-dock-out');
    ghost.style.pointerEvents = 'none';
    ghost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ghost);
  }
  root.style.setProperty('--kb-h', '0px'); // layar turun lagi (transisi di <html>)
  setTimeout(() => {
    ghost?.remove();
    if (dockCount > 0) return; // keburu ada dock baru
    root.classList.remove('nominal-dock');
    root.style.removeProperty('--kb-h');
    root.style.removeProperty('--nav-h');
  }, DOCK_MS + 40);
}

export default function NominalDock({ z = 'z-[110]', onClose, hidden = false, children }) {
  const ref = useRef(null);
  useBackLayer(true, onClose);
  useNominalOpenClass();

  // Pasang / cabut dock: urus serah-terima antar kolom & animasi keluar.
  useLayoutEffect(() => {
    const el = ref.current;
    if (pendingExit && el) el.style.animation = 'none'; // menggantikan dock lain: jangan meluncur ulang
    pendingExit = false;
    dockCount += 1;
    return () => {
      dockCount -= 1;
      pendingExit = true;
      const ghost = el && el.style.display !== 'none' ? el.cloneNode(true) : null;
      queueMicrotask(() => {
        if (!pendingExit || dockCount > 0) return; // sudah digantikan
        pendingExit = false;
        finishExit(ghost);
      });
    };
  }, []);

  // Ukur tinggi dock -> --kb-h (dianimasikan lewat transisi di <html>).
  useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el) return undefined;
    if (hidden) {
      root.classList.remove('nominal-dock');
      root.style.setProperty('--kb-h', '0px');
      return undefined;
    }
    const nav = document.querySelector('[data-bottom-nav]');
    root.style.setProperty('--nav-h', `${nav ? nav.offsetHeight : 0}px`);
    root.classList.add('nominal-dock');
    const apply = () => root.style.setProperty('--kb-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
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
      className={`nominal-dock-in fixed bottom-0 left-0 right-0 ${z}`}
    >
      {children}
    </div>,
    document.body,
  );
}
