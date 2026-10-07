import { useEffect, useRef, useState } from 'react';

/**
 * Overlay — kerangka SEMUA tumpukan layar (modal, bottom sheet, laci, dropdown):
 *
 *  - ANIMASI MASUK & KELUAR. Proyek ini tidak punya plugin animasi (`animate-in` /
 *    `slide-in-from-*` TIDAK ada di Tailwind v4 polos), jadi gerakan dibuat manual
 *    dengan transition: render dulu di posisi "luar layar", frame berikutnya pindah ke
 *    posisi akhir. Saat ditutup, komponen tetap terpasang sampai animasi keluar selesai.
 *  - Posisi akhir memakai `translate-none`/`scale-none` (bukan translate-0) supaya panel TIDAK
 *    menyisakan transform — transform di leluhur membuat elemen `fixed` di dalamnya
 *    (mis. pemilih pelanggan di dalam keranjang) ikut terkurung di panel.
 *  - Yang muncul dari bawah (sheet) keluar lagi KE BAWAH; laci kanan keluar ke kanan;
 *    dropdown atas ke atas; dialog tengah memudar + mengecil.
 *  - SWIPE KE BAWAH untuk menutup (varian sheet/responsive): geser dari mana saja di
 *    panel selama isi panel sedang di paling atas. Lepas > ~110px (atau sentakan cepat)
 *    = tutup, kurang dari itu = membal kembali. Tandai elemen dengan `data-no-swipe`
 *    untuk mengecualikannya.
 *  - Isi terakhir dibekukan selama animasi keluar, jadi walau state induk sudah
 *    di-reset (form kosong, keranjang dihapus) isi panel tidak berubah/kedip sambil turun.
 *    Karena itu pemanggil cukup render <Overlay open={false} /> saat tertutup.
 *
 * Props:
 *   open, onClose
 *   variant        'sheet' | 'responsive' (sheet di HP, dialog tengah di md+) | 'center' | 'right' | 'top'
 *   z              kelas z-index (default 'z-[60]')
 *   backdropClass  kelas warna/blur latar
 *   containerClass kelas flex penataan posisi (override default per varian)
 *   panelClass     kelas panel
 *   swipe          boolean — izinkan swipe-turun (default: true untuk sheet & responsive)
 *   closeOnBackdrop boolean (default true)
 *   ignoreKeyboard boolean — jangan ikut memendek saat keypad nominal terpasang (mis. kalkulator)
 */
const MOTION = {
  sheet: { on: 'translate-none', off: 'translate-y-full', tr: 'transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]', ms: 300 },
  responsive: { on: 'translate-none md:scale-none md:opacity-100', off: 'translate-y-full md:translate-y-0 md:scale-95 md:opacity-0', tr: 'transition-[transform,translate,scale,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]', ms: 300 },
  center: { on: 'scale-none opacity-100', off: 'scale-95 opacity-0', tr: 'transition-[transform,scale,opacity] duration-200 ease-out', ms: 200 },
  right: { on: 'translate-none', off: 'translate-x-full', tr: 'transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]', ms: 300 },
  top: { on: 'translate-none', off: '-translate-y-full', tr: 'transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]', ms: 300 },
};
const LAYOUT = {
  sheet: 'items-end justify-center',
  responsive: 'items-end md:items-center justify-center md:p-4',
  center: 'items-center justify-center p-4',
  right: 'justify-end',
  top: 'flex-col',
};
const DEFAULT_BACKDROP = 'bg-black/60 backdrop-blur-sm';

function swipeBlocked(target, panel) {
  for (let el = target; el && el !== panel; el = el.parentElement) {
    if (el.dataset && el.dataset.noSwipe !== undefined) return true;
    if (el.scrollTop > 0) return true; // daftar di dalam sedang tergulir ke bawah
  }
  return panel.scrollTop > 0;
}

function useSwipeDown(panelRef, backdropRef, { enabled, responsive, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const el = panelRef.current;
    if (!el || !enabled) return undefined;
    const s = { on: false, decided: false, x: 0, y: 0, t: 0, dy: 0 };
    const backdrop = () => backdropRef.current;

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      if (responsive && window.matchMedia('(min-width: 768px)').matches) return;
      if (swipeBlocked(e.target, el)) return;
      s.on = true; s.decided = false; s.dy = 0;
      s.x = e.touches[0].clientX; s.y = e.touches[0].clientY; s.t = performance.now();
    };
    const onMove = (e) => {
      if (!s.on) return;
      const dy = e.touches[0].clientY - s.y;
      const dx = e.touches[0].clientX - s.x;
      if (!s.decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        s.decided = true;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { s.on = false; return; }
        el.style.transition = 'none';
        if (backdrop()) backdrop().style.transition = 'none';
      }
      s.dy = Math.max(0, dy);
      el.style.translate = `0 ${s.dy}px`;
      if (backdrop()) backdrop().style.opacity = String(Math.max(0, 1 - s.dy / Math.max(1, el.offsetHeight)));
    };
    const onEnd = () => {
      if (!s.on) return;
      s.on = false;
      if (!s.decided) return;
      const velocity = s.dy / Math.max(1, performance.now() - s.t); // px/ms
      el.style.transition = '';
      if (backdrop()) backdrop().style.transition = '';
      if (s.dy > 110 || (s.dy > 30 && velocity > 0.5)) {
        el.style.translate = '0 100%';
        if (backdrop()) backdrop().style.opacity = '0';
        closeRef.current?.();
        // Kalau induk menolak menutup, kembalikan panel.
        setTimeout(() => {
          if (!el.isConnected) return;
          el.style.translate = '';
          if (backdrop()) backdrop().style.opacity = '';
        }, 450);
      } else {
        el.style.translate = '0 0';
        if (backdrop()) backdrop().style.opacity = '';
        setTimeout(() => { if (el.isConnected) el.style.translate = ''; }, 320);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [panelRef, backdropRef, enabled, responsive]);
}

export default function Overlay(props) {
  const { open } = props;
  // Bekukan props terakhir saat terbuka -> dipakai selama animasi keluar.
  const frozen = useRef(props);
  if (open) frozen.current = props;
  const p = open ? props : frozen.current;
  const {
    variant = 'center', z = 'z-[60]', backdropClass = DEFAULT_BACKDROP, containerClass, panelClass = '',
    onClose, closeOnBackdrop = true, ignoreKeyboard = false, children,
  } = p;
  const motion = MOTION[variant] ?? MOTION.center;
  const swipe = p.swipe ?? (variant === 'sheet' || variant === 'responsive');

  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef(null);
  const backdropRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setEntered(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setEntered(false);
    const t = setTimeout(() => setMounted(false), motion.ms + 30);
    return () => clearTimeout(t);
  }, [open, motion.ms]);

  useSwipeDown(panelRef, backdropRef, {
    enabled: swipe && open && Boolean(onClose),
    responsive: variant === 'responsive',
    onClose,
  });

  if (!open && !mounted) return null;

  return (
    <div
      className={`fixed inset-0 ${z} flex ${containerClass ?? LAYOUT[variant] ?? LAYOUT.center} ${open ? '' : 'pointer-events-none'}`}
      data-kb-ignore={ignoreKeyboard ? '' : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={backdropRef}
        onClick={() => { if (closeOnBackdrop && onClose) onClose(); }}
        className={`absolute inset-0 transition-opacity duration-300 ${backdropClass} ${entered ? 'opacity-100' : 'opacity-0'}`}
      />
      <div ref={panelRef} className={`relative ${motion.tr} ${entered ? motion.on : motion.off} ${panelClass}`}>
        {children}
      </div>
    </div>
  );
}
