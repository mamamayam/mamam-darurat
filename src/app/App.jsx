import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Modal, Button } from '../components/ui';
import AppRoutes, { VIEWS } from './AppRoutes';
import BottomSheetMenu from './layout/BottomSheetMenu';
import Header from './layout/Header';
import BottomNav from './layout/BottomNav';
import { AppContext } from '../context/AppContext';
import { formatRupiah } from '../utils/formatters';
import { useAuth } from '../auth/AuthContext';
import LoginScreen from '../auth/LoginScreen';
import { VIEW_PERMISSION } from '../auth/permissions';
import { backStack } from '../lib/backStack';

import {
  Briefcase,
  Clock,
  Fingerprint,
  List,
  ShoppingCart,
  TrendingDown,
  BarChart3,
  History,
  Users,
  UserCog,
} from 'lucide-react';

/**
 * App.jsx — Aplikasi C ("mamam-darurat").
 *
 * Ini BUKAN port 1:1 dari App.jsx test-app-baru (mamam-global) — itu file
 * monolitik yang nyampur mesin navigasi dengan SEMUA state bisnis (POS
 * store, sync engine, PIN admin, payroll auto-backfill, push notif, dll).
 *
 * Yang DIPERTAHANKAN persis (pola & logika, ditulis ulang bersih):
 *   - Stack navigation per-root: navigate() / navigateToSub() / navigateBack()
 *   - mountedViews (Set) — cabang yang tidak aktif TETAP mounted
 *     (visibility:hidden di AppRoutes), state internal tidak reset
 *   - navDirection — dibaca AppRoutes.jsx untuk varian animasi slide
 *
 * Yang DIBUANG (di luar scope Aplikasi C / gelombang 1):
 *   - syncEngine, usePersistState, usePosStore (Dexie/offline) — C online-first
 *   - PIN admin sungguhan, push notifications, Capacitor back-button
 *     (App.jsx test-app-baru target APK Android; C web/PWA — tombol Back dan
 *     "ketuk lagi untuk keluar" ditangani lib/backStack.js)
 *   - Auto-backfill payroll/libur, online/offline toast
 *
 * Guard shift: PosView tidak bisa diakses kalau belum ada shift yang
 * `closed_at IS NULL` — logic ini akan diimplementasi di dalam PosView/
 * ShiftView sendiri lewat query Supabase, BUKAN di sini (App.jsx tidak tahu
 * apa pun soal data bisnis).
 */
export default function App() {
  const { role, logout, can: allowed } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Modal konfirmasi generik — dipakai BottomSheetMenu (logout admin) dan
  // bisa dipakai fitur lain lewat context kalau nanti perlu.
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
  const triggerConfirm = useCallback((message, onConfirm) => {
    setConfirmModal({ isOpen: true, message, onConfirm });
  }, []);
  const closeConfirm = useCallback(() => {
    setConfirmModal({ isOpen: false, message: '', onConfirm: null });
  }, []);

  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '' });
  const triggerAlert = useCallback((message) => setAlertModal({ isOpen: true, message }), []);

  // --- STACK NAVIGATION PER-ROOT (dipertahankan dari test-app-baru) ---
  const [currentView, setCurrentView] = useState('beranda');
  const [viewHistory, setViewHistory] = useState([]);
  const [mountedViews, setMountedViews] = useState(() => new Set(['beranda']));
  const [navDirection, setNavDirection] = useState('forward-root');

  const navigate = useCallback((view) => {
    if (view === currentView) return;
    setViewHistory([]);
    setMountedViews(new Set([view]));
    setNavDirection('forward-root');
    setCurrentView(view);
  }, [currentView]);

  const navigateToSub = useCallback((view) => {
    if (view === currentView) return;
    setViewHistory(prev => [...prev, currentView]);
    setMountedViews(prev => new Set(prev).add(view));
    setNavDirection('forward-sub');
    setCurrentView(view);
  }, [currentView]);

  const navigateBack = useCallback(() => {
    if (viewHistory.length > 0) {
      const prev = viewHistory[viewHistory.length - 1];
      setViewHistory(h => h.slice(0, -1));
      setNavDirection('backward-sub');
      setCurrentView(prev);
    } else if (currentView !== 'beranda') {
      setMountedViews(new Set(['beranda']));
      setNavDirection('backward-root');
      setCurrentView('beranda');
    }
    // Di Beranda tanpa history tidak ada yang dilakukan di sini: Back ditangani
    // backStack ("ketuk lagi untuk keluar", notifnya = components/ui/ExitToast).
  }, [viewHistory, currentView]);

  // --- Tombol Back browser/HP <-> stack navigasi ---
  // Kedalaman stack = jumlah sub-layar, ditambah 1 kalau stack berakar di layar selain
  // Beranda (Back dari layar itu kembali ke Beranda, seperti navigateBack di atas).
  // Tiap tingkat punya satu "lapisan" di backStack; menekan Back = navigateBack().
  // Modal/laci yang terbuka mendaftar sendiri (useBackLayer) dan ditutup lebih dulu.
  // Di Beranda tanpa lapisan terbuka, Back pertama menampilkan "Ketuk lagi untuk keluar"
  // dan Back kedua keluar dari aplikasi (diatur backStack, bukan di sini).
  const navDepth = viewHistory.length + ((viewHistory[0] ?? currentView) !== 'beranda' ? 1 : 0);
  const navigateBackRef = useRef(navigateBack);
  useEffect(() => { navigateBackRef.current = navigateBack; });
  const navLayerIds = useRef([]);
  useEffect(() => {
    const ids = navLayerIds.current.filter((id) => backStack.has(id));   // buang yang sudah dipakai tombol Back
    while (ids.length > navDepth) backStack.unregister(ids.pop());
    while (ids.length < navDepth) ids.push(backStack.register(() => navigateBackRef.current()));
    navLayerIds.current = ids;
  }, [navDepth]);

  // Helper UI + navigasi yang dibagikan ke semua View lewat useAppContext().
  // Diletakkan SETELAH navigate/navigateToSub/navigateBack didefinisikan
  // (bug yang pernah terjadi: dideklarasikan sebelum navigate ada, sehingga
  // View yang memanggil navigate() dari context diam-diam gagal).
  const appContextValue = useMemo(
    () => ({ triggerAlert, triggerConfirm, formatRupiah, navigate, navigateToSub, navigateBack }),
    [triggerAlert, triggerConfirm, navigate, navigateToSub, navigateBack]
  );

  // --- Menu untuk BottomSheetMenu — 9 fitur gelombang 1 Aplikasi C ---
  // NB: 'laporan' sudah termasuk Laba Rugi (bukan menu terpisah seperti
  // 'labarugi' di test-app-baru) — lihat ReportsView.
  const menuItems = useMemo(() => [
    { id: 'kasir',       icon: ShoppingCart, label: 'Kasir' },
    { id: 'dompet',      icon: Clock,        label: 'Dompet / Shift' },
    { id: 'menu',        icon: List,         label: 'Manajemen Menu' },
    { id: 'pelanggan',   icon: Users,        label: 'Pelanggan' },
    { id: 'pengeluaran', icon: TrendingDown, label: 'Pengeluaran' },
    { id: 'karyawan',    icon: UserCog,      label: 'Karyawan' },
    { id: 'absensi',     icon: Fingerprint,  label: 'Absensi' },
    { id: 'penggajian',  icon: Briefcase,    label: 'Penggajian' },
    { id: 'riwayat',     icon: History,      label: 'Riwayat' },
    { id: 'laporan',     icon: BarChart3,    label: 'Laporan' },
  ], []);

  // Menu yang butuh izin khusus (mis. Penggajian, Manajemen Menu) disembunyikan
  // dari peran yang tidak berhak. Pagar kedua ada di AppRoutes.
  const visibleMenus = useMemo(
    () => menuItems.filter(item => !VIEW_PERMISSION[item.id] || allowed(VIEW_PERMISSION[item.id])),
    [menuItems, allowed]
  );

  // Keluar: kembali ke Beranda supaya peran berikutnya tidak mendarat di layar yang bukan miliknya.
  const handleLogout = useCallback(() => {
    setViewHistory([]);
    setMountedViews(new Set(['beranda']));
    setNavDirection('forward-root');
    setCurrentView('beranda');
    logout();
  }, [logout]);

  const today = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  // TODO(gelombang berikutnya): currentShift ini harus berasal dari query
  // Supabase (`shifts` yang `closed_at IS NULL`), disuplai oleh ShiftView
  // lewat context/hook bersama — sekarang masih placeholder false supaya
  // App.jsx bisa dirender & ditest independen dari data layer.
  const currentShift = false;

  // Belum masuk: tampilkan layar PIN saja (tidak ada data yang dimuat).
  if (!role) return <LoginScreen />;

  return (
    <AppContext.Provider value={appContextValue}>
    <div className="h-screen h-dvh w-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header
        currentShift={currentShift}
        currentView={currentView}
        today={today}
      />

      <AppRoutes
        currentView={currentView}
        mountedViews={mountedViews}
        navDirection={navDirection}
      />

      <BottomNav
        currentView={currentView}
        navigate={navigate}
        onOpenMenu={() => setIsMenuOpen(true)}
      />

      <BottomSheetMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        visibleMenus={visibleMenus}
        currentView={currentView}
        navigate={navigate}
        role={role}
        onLogout={() => triggerConfirm('Yakin ingin keluar?', handleLogout)}
      />

      <Modal isOpen={confirmModal.isOpen} onClose={closeConfirm} size="sm" zLevel="top">
        <div className="p-5">
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{confirmModal.message}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={closeConfirm}>Batal</Button>
            <Button onClick={() => { confirmModal.onConfirm?.(); closeConfirm(); }}>Ya, Lanjutkan</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={alertModal.isOpen} onClose={() => setAlertModal({ isOpen: false, message: '' })} size="sm" zLevel="top">
        <div className="p-5">
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{alertModal.message}</p>
          <div className="flex justify-end">
            <Button onClick={() => setAlertModal({ isOpen: false, message: '' })}>Oke</Button>
          </div>
        </div>
      </Modal>
    </div>
    </AppContext.Provider>
  );
}
