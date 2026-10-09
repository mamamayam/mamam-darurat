import { useState, useRef, useCallback, useEffect } from 'react';
import { itemAtPoint } from './menuOrder';

/**
 * useGridReorder — drag & drop untuk grid (pointer: jari maupun mouse). Beda dengan
 * useDragReorder (khusus daftar vertikal): di sini penentu tujuannya persegi panjang elemen
 * yang sedang disentuh, jadi bekerja untuk grid 3 kolom ke segala arah.
 *
 * - startDrag(id) dipasang di onPointerDown elemen (elemen perlu touch-action: none).
 * - Saat jari masuk ke elemen lain, onMove(dragId, targetId) dipanggil (urutan berubah langsung
 *   seperti di layar utama HP). Saat dilepas, onDrop() dipanggil.
 * - `drag` = { id, x, y, w, h, dx, dy } untuk menggambar "bayangan" yang mengikuti jari, atau null.
 */
export function useGridReorder({ onMove, onDrop }) {
  const [drag, setDrag] = useState(null);
  const refs = useRef({});
  const dragIdRef = useRef(null);
  const cbRef = useRef({ onMove, onDrop });
  useEffect(() => { cbRef.current = { onMove, onDrop }; });

  const registerRef = useCallback((id) => (el) => {
    if (el) refs.current[id] = el; else delete refs.current[id];
  }, []);

  const startDrag = useCallback((id) => (e) => {
    if (e.button > 0) return;                       // hanya klik kiri / sentuhan
    const el = refs.current[id];
    if (!el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    dragIdRef.current = id;
    setDrag({ id, x: e.clientX, y: e.clientY, w: r.width, h: r.height, dx: e.clientX - r.left, dy: e.clientY - r.top });
  }, []);

  const dragId = drag?.id ?? null;
  useEffect(() => {
    if (dragId === null) return undefined;
    const onPointerMove = (e) => {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      const rects = {};
      for (const [id, el] of Object.entries(refs.current)) rects[id] = el.getBoundingClientRect();
      const target = itemAtPoint(rects, e.clientX, e.clientY);
      if (target && target !== dragIdRef.current) cbRef.current.onMove(dragIdRef.current, target);
    };
    const finish = () => {
      dragIdRef.current = null;
      setDrag(null);
      cbRef.current.onDrop?.();
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [dragId]);

  return { drag, registerRef, startDrag };
}
