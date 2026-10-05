import React from 'react';
import { LogOut } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { roleLabel } from '../../auth/permissions';

/**
 * BottomSheetMenu — swipe-up sheet, ported dari test-app-baru (mamam-global).
 * Grid 3-kolom untuk 9 menu gelombang 1 Aplikasi C.
 *
 * BEDA dari versi asli: card "Notifikasi" di atas grid DIHAPUS — C belum
 * punya push notifications/NotificationBell (di luar scope gelombang 1).
 * Kalau nanti perlu, tinggal port ulang dari test-app-baru.
 */
export default function BottomSheetMenu({
  isOpen,
  onClose,
  visibleMenus,
  currentView,
  navigate,
  role,
  onLogout,
}) {
  const handleSelect = (id) => {
    navigate(id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} sheet size="lg" maxHeight className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="px-5 pt-4 pb-2">
        {/* Grid menu 3 kolom */}
        <div className="grid grid-cols-3 gap-x-2 gap-y-5">
          {visibleMenus.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-200 group-active:scale-90 ${
                    isActive
                      ? 'bg-gradient-to-br from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <item.icon className={`w-[22px] h-[22px] ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`} />
                </div>
                <span className={`text-[11px] font-semibold text-center leading-tight ${isActive ? 'text-accent-600 dark:text-accent-400' : 'text-slate-600 dark:text-slate-300'}`}>
                  {item.label}
                </span>
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
        </div>
      </div>
    </Modal>
  );
}
