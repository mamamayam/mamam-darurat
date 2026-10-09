import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Pencil } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { orderMenus, moveId, readMenuOrder, saveMenuOrder, clearMenuOrder } from './menuOrder';
import { useGridReorder } from './useGridReorder';
import { fetchMenuOrder, pushMenuOrder, deleteMenuOrder } from './menuOrderSync';
import { supabase } from '../../lib/supabase';
import { roleLabel } from '../../auth/permissions';
import { versionLabel } from '../../lib/appVersion';

/**
 * BottomSheetMenu — swipe-up sheet, ported dari test-app-baru (mamam-global).
 * Grid 3-kolom untuk 9 menu gelombang 1 Aplikasi C.
 *
 * BEDA dari versi asli: card "Notifikasi" di atas grid DIHAPUS — C belum
 * punya push notifications/NotificationBell (di luar scope gelombang 1).
 * Kalau nanti perlu, tinggal port ulang dari test-app-baru.
 *
 * Urutan ikon bisa diatur sendiri: ketuk "Atur", geser ikon ke posisi yang diinginkan, lalu "Selesai".
 * Urutan disimpan per peran: di perangkat ini (localStorage, langsung tampil) DAN di server (app_settings,
 * lihat menuOrderSync.js) supaya ikut ke HP/browser mana pun. Server dibaca tiap menu dibuka; kalau offline,
 * urutan lokal tetap dipakai dan dikirim saat tersambung. "Reset" mengembalikan urutan bawaan.
 */

function MenuTile({ item, isActive, ghost = false }) {
  return (
    <>
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-200 ${ghost ? 'scale-110 shadow-xl' : 'group-active:scale-90'} ${
          isActive
            ? 'bg-gradient-to-br from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600'
            : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        <item.icon className={`w-[22px] h-[22px] ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`} />
      </div>
      <span className={`text-xs font-semibold text-center leading-tight ${isActive ? 'text-accent-600 dark:text-accent-400' : 'text-slate-600 dark:text-slate-300'}`}>
        {item.label}
      </span>
    </>
  );
}
export default function BottomSheetMenu({
  isOpen,
  onClose,
  visibleMenus,
  currentView,
  navigate,
  role,
  onLogout,
}) {
  const [editing, setEditing] = useState(false);
  const [savedIds, setSavedIds] = useState(() => readMenuOrder(role));
  useEffect(() => { setSavedIds(readMenuOrder(role)); }, [role]);
  useEffect(() => { if (!isOpen) setEditing(false); }, [isOpen]);
  // simpan tiap urutan berubah (null = urutan bawaan, tidak ada yang disimpan)
  useEffect(() => { if (savedIds) saveMenuOrder(role, savedIds); }, [savedIds]); // eslint-disable-line react-hooks/exhaustive-deps -- cuma saat urutan berubah, bukan saat role ganti

  // ── Sinkron ke server (lintas perangkat) ──
  const fetchedRef = useRef(false);     // sudah berhasil membaca server sejak menu dibuka (jangan kirim sebelum itu: bisa menimpa urutan baru dengan yang basi)
  const syncedRef = useRef(undefined);  // JSON urutan yang diketahui ada di server ('null' = belum ada)
  const dirtyRef = useRef(false);       // ada perubahan lokal yang belum terkirim (mis. diubah saat offline)
  const editingRef = useRef(false);
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  const ordered = useMemo(() => orderMenus(visibleMenus, savedIds), [visibleMenus, savedIds]);
  const { drag, registerRef, startDrag } = useGridReorder({
    onMove: (from, to) => { dirtyRef.current = true; setSavedIds((prev) => moveId(orderMenus(visibleMenus, prev).map((m) => m.id), from, to)); },
  });
  const draggedItem = drag ? ordered.find((m) => m.id === drag.id) : null;

  useEffect(() => {
    if (!isOpen) { fetchedRef.current = false; return undefined; }
    let cancelled = false;
    fetchMenuOrder(supabase, role).then((remote) => {
      if (cancelled || remote === undefined) return;   // offline/galat: pakai urutan lokal
      syncedRef.current = remote ? JSON.stringify(remote) : 'null';
      fetchedRef.current = true;
      if (remote && !dirtyRef.current && !editingRef.current) setSavedIds(remote);   // server menang, kecuali ada perubahan lokal yang belum terkirim
      else setSyncTick((t) => t + 1);                                              // kirim urutan lokal ke server
    });
    return () => { cancelled = true; };
  }, [isOpen, role]);
  useEffect(() => {
    if (!savedIds || drag || !fetchedRef.current) return undefined;
    const json = JSON.stringify(savedIds);
    if (json === syncedRef.current) return undefined;
    const t = setTimeout(async () => {
      if (await pushMenuOrder(supabase, role, savedIds)) { syncedRef.current = json; dirtyRef.current = false; }
    }, 500);
    return () => clearTimeout(t);
  }, [savedIds, drag, role, syncTick]);

  const handleSelect = (id) => {
    if (editing) return;
    navigate(id);
    onClose();
  };
  const handleReset = () => {
    clearMenuOrder(role); setSavedIds(null); dirtyRef.current = false;
    deleteMenuOrder(supabase, role).then((ok) => { if (ok) syncedRef.current = 'null'; });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} sheet size="lg" maxHeight className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between min-h-8 mb-3">
          <p className="text-xs text-slate-400 dark:text-slate-500" data-testid="menu-atur-petunjuk">{editing ? 'Geser ikon ke posisi yang kamu mau' : ''}</p>
          <div className="flex items-center gap-1">
            {editing && (
              <button type="button" onClick={handleReset} data-testid="menu-reset"
                className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 active:scale-95 transition-all">Reset</button>
            )}
            <button type="button" onClick={() => setEditing((v) => !v)} data-testid="menu-atur"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all ${editing ? 'bg-accent-600 text-white' : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
              {!editing && <Pencil className="w-3 h-3" />}{editing ? 'Selesai' : 'Atur'}
            </button>
          </div>
        </div>

        {/* Grid menu 3 kolom */}
        <div className="grid grid-cols-3 gap-x-2 gap-y-5" data-no-swipe={editing ? '' : undefined} data-testid="menu-grid">
          {ordered.map((item) => {
            const isActive = currentView === item.id;
            const isDragged = drag?.id === item.id;
            return (
              <button
                key={item.id}
                ref={registerRef(item.id)}
                data-testid={`menu-${item.id}`}
                onClick={() => handleSelect(item.id)}
                onPointerDown={editing ? startDrag(item.id) : undefined}
                style={editing ? { touchAction: 'none' } : undefined}
                className={`flex flex-col items-center gap-2 group rounded-2xl select-none ${editing ? 'cursor-grab py-1 ring-1 ring-dashed ring-accent-300 dark:ring-accent-500/40' : ''} ${isDragged ? 'opacity-30' : ''}`}
              >
                <MenuTile item={item} isActive={isActive} />
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">Masuk sebagai <span className="font-bold text-slate-600 dark:text-slate-300" data-testid="role-label">{roleLabel(role)}</span></p>
          <button
            onClick={() => { onClose(); onLogout(); }}
            className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 py-3 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
          <p className="text-center text-[11px] text-slate-300 dark:text-slate-600" data-testid="app-version">{versionLabel()}</p>
        </div>
      </div>
      {drag && draggedItem && createPortal(
        <div className="fixed z-[9999] pointer-events-none flex flex-col items-center gap-2 opacity-95" data-testid="menu-ghost"
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w }}>
          <MenuTile item={draggedItem} isActive={currentView === draggedItem.id} ghost />
        </div>,
        document.body
      )}
    </Modal>
  );
}
