import React from "react";
import { Home, ShoppingCart, Menu } from "lucide-react";

// Ported dari test-app-baru (mamam-global) — pure UI, tidak ada
// dependency ke data/sync sama sekali.
//
// Navbar SELALU tampil & nempel di dasar layar (termasuk HP landscape):
//  - bukan lagi `short:hidden`; di layar pendek tinggi bar mengecil (h-12)
//  - 3 tombol dibagi rata (flex-1) dan seluruhnya ada DI DALAM bar —
//    tombol Kasir tidak lagi nongol ke atas menimpa konten halaman
//  - safe-area bawah (gesture bar / home indicator) jadi padding bar, jadi
//    tombol tidak ketutup tapi bar tetap mentok di tepi layar
// Elemen lain yang melayang di atas bar (FAB keranjang, ExitToast) memakai
// offset yang sama: tinggi bar + safe-area.
const LABEL = "text-xs short:text-xs leading-none font-bold transition-colors duration-300";

export default function BottomNav({
    currentView,
    navigate,
    onOpenMenu,
}) {
    const tabClass = (active) =>
        `flex-1 min-w-0 flex flex-col items-center justify-center gap-1 short:gap-0.5 transition-all duration-300 active:scale-95 ${
            active
                ? 'text-accent-600 dark:text-accent-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
        }`;

    return (
        <nav
            data-bottom-nav
            aria-label="Navigasi utama"
            className="shrink-0 z-30 print:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-100/60 dark:border-slate-900 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] dark:shadow-none pb-[env(safe-area-inset-bottom,0px)]"
        >
            <div className="flex items-stretch h-16 short:h-12">

                {/* Tombol Beranda */}
                <button onClick={() => navigate('beranda')} className={tabClass(currentView === 'beranda')}>
                    <Home className="w-5 h-5 short:w-4 short:h-4" />
                    <span className={LABEL}>Beranda</span>
                </button>

                {/* Tombol Kasir (aksen di tengah, tetap di dalam bar) */}
                <button
                    onClick={() => navigate('kasir')}
                    className="group flex-1 min-w-0 flex flex-col items-center justify-center gap-1 short:gap-0.5"
                >
                    <span className="w-11 h-11 short:w-8 short:h-8 rounded-2xl short:rounded-xl flex items-center justify-center shadow-[0_8px_20px_rgba(var(--color-accent-500),0.4)] transition-transform duration-300 group-active:scale-95 bg-gradient-to-br from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600">
                        <ShoppingCart className="w-5 h-5 short:w-4 short:h-4 text-white" />
                    </span>
                    <span className={`${LABEL} ${
                        currentView === 'kasir'
                            ? 'text-accent-600 dark:text-accent-400'
                            : 'text-slate-600 dark:text-slate-300'
                    }`}>
                        Kasir
                    </span>
                </button>

                {/* Tombol Menu — buka BottomSheetMenu */}
                <button onClick={onOpenMenu} className={tabClass(false)}>
                    <Menu className="w-5 h-5 short:w-4 short:h-4" />
                    <span className={LABEL}>Menu</span>
                </button>

            </div>
        </nav>
    );
}
