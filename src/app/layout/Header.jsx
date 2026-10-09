import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { formatJam, formatTanggal, msKeDetikBerikutnya } from "./clockFormat";

// Ported dari test-app-baru (mamam-global). BEDA dari versi asli:
// - NotificationBell dihapus (C belum punya push notif — di luar scope
//   gelombang 1)
// - Tombol hamburger/sidebar DIHAPUS — C tidak punya Sidebar drawer sama
//   sekali, navigasi cuma lewat BottomNav + BottomSheetMenu (swipe-up).
//   Tombol itu di versi asli cuma fallback mobile buat buka Sidebar yang
//   di test-app-baru sendiri sebenarnya sudah gak dipakai (superseded oleh
//   BottomSheetMenu) — jadi wajar terhapus di C, bukan fitur yang hilang.
// currentShift tetap dipertahankan sebagai boolean/object sederhana yang
// disuplai App.jsx dari state shift lokal.

// Jam & tanggal di pojok kanan atas: tampil di semua ukuran layar (termasuk HP).
// Sumber waktu = jam perangkat. Detik berganti tepat di pergantian detik (bukan setInterval
// yang bisa melenceng), dan langsung disegarkan lagi saat app kembali dibuka dari background.
function useNow() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        let timer;
        const tick = () => {
            const sekarang = new Date();
            setNow(sekarang);
            timer = setTimeout(tick, msKeDetikBerikutnya(sekarang));
        };
        timer = setTimeout(tick, msKeDetikBerikutnya(new Date()));

        const segarkan = () => {
            if (document.visibilityState === 'visible') setNow(new Date());
        };
        document.addEventListener('visibilitychange', segarkan);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', segarkan);
        };
    }, []);
    return now;
}

// Dipisah dari Header supaya hanya blok jam yang render ulang tiap detik.
function HeaderClock() {
    const now = useNow();
    return (
        <div className="flex flex-col items-end leading-tight text-slate-500 dark:text-slate-400 whitespace-nowrap" data-testid="header-jam-tanggal">
            <span className="text-[11px] short:text-[10px] font-semibold">{formatTanggal(now)}</span>
            <span className="font-heading text-sm short:text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">{formatJam(now)}</span>
        </div>
    );
}

export default function Header({
    currentShift,
    currentView,
}) {
    return (
        <header className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-100/60 dark:border-slate-900 h-16 short:h-12 flex items-center justify-between px-4 short:px-3 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-none shrink-0">
            <div className="flex items-center gap-3 short:gap-2">
                <h2 className="font-heading font-bold text-xl short:text-base tracking-tight capitalize bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    {currentView.replace('-', ' ')}
                </h2>
            </div>
            <div className="flex items-center gap-2.5 short:gap-1.5">
                {currentShift && (
                    <span className="hidden md:inline-flex short:!hidden items-center gap-1.5 bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-[0_4px_14px_rgba(var(--color-accent-500),0.35)]">
                        <Clock className="w-3.5 h-3.5" /> Dompet Aktif
                    </span>
                )}
                <HeaderClock />
            </div>
        </header>
    );
}
