import { useEffect, useRef, useState } from 'react';

/**
 * usePullToRefresh — tarik layar ke bawah (dari paling atas) untuk memuat ulang halaman.
 *
 * Kenapa buatan sendiri: refresh bawaan browser sengaja dimatikan di index.css
 * (overscroll-behavior: none) dan di area konten (overscroll-y-contain) supaya header &
 * navbar tidak ikut tergeser. Jadi gestur ini dipasang manual di area konten saja.
 *
 * Pengaman supaya data tidak hilang karena salah tarik — gestur TIDAK jalan kalau:
 *  - sentuhan dimulai di dalam elemen position:fixed (modal, laci keranjang, sheet)
 *  - keypad/kalkulator nominal terbuka (html.nominal-open)
 *  - ada kolom input/textarea/select yang sedang fokus
 *  - konten (atau salah satu induknya sampai root) sedang tidak di paling atas
 *  - elemen punya atribut data-no-ptr
 *  - geseran lebih ke samping daripada ke bawah
 */
export const PTR_THRESHOLD = 70;   // px tarikan (setelah diredam) yang dibutuhkan
const PTR_MAX = 110;
const DAMPING = 0.5;

function isBlocked(target, root) {
  if (document.documentElement.classList.contains('nominal-open')) return true;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
  for (let el = target; el && el !== root; el = el.parentElement) {
    if (el.dataset && el.dataset.noPtr !== undefined) return true;
    if (el.scrollTop > 0) return true;
    if (getComputedStyle(el).position === 'fixed') return true;
  }
  return false;
}

export function usePullToRefresh(rootRef, { onRefresh } = {}) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const st = useRef({ tracking: false, decided: false, x: 0, y: 0, pull: 0 });
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const s = st.current;

    const reset = () => { s.tracking = false; s.decided = false; s.pull = 0; setDragging(false); setPull(0); };

    const onStart = (e) => {
      if (e.touches.length !== 1 || isBlocked(e.target, root)) { s.tracking = false; return; }
      s.tracking = true; s.decided = false; s.pull = 0;
      s.x = e.touches[0].clientX; s.y = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (!s.tracking) return;
      const dy = e.touches[0].clientY - s.y;
      const dx = e.touches[0].clientX - s.x;
      if (!s.decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;   // belum jelas arahnya
        s.decided = true;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { s.tracking = false; return; }
        setDragging(true);
      }
      if (dy <= 0) { s.pull = 0; setPull(0); return; }
      s.pull = Math.min(PTR_MAX, dy * DAMPING);
      setPull(s.pull);
    };
    const onEnd = () => {
      if (!s.tracking) return;
      const done = s.pull >= PTR_THRESHOLD;
      s.tracking = false;
      setDragging(false);
      if (done) {
        setRefreshing(true);
        setPull(PTR_THRESHOLD);
        (onRefreshRef.current || (() => window.location.reload()))();
      } else {
        reset();
      }
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', reset);
    };
  }, [rootRef]);

  return { pull, dragging, refreshing };
}
