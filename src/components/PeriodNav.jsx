import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays } from 'lucide-react';
import { Modal } from './ui';

/**
 * PeriodNav — navigasi periode (Absensi harian, Penggajian mingguan/bulanan).
 *
 *  [<]  [ 📅 label periode ▾ ]  [>]
 *       [    Ke hari ini    ]
 *
 * - Label periode BISA DIKETUK untuk memilih periode langsung:
 *     picker = { title, value, options:[{value,label,tag?}], onChange, dateInput? }
 *     -> bottom sheet daftar periode (hari / minggu / bulan); yang aktif ditandai &
 *        otomatis digulir ke tengah. `dateInput` menambah kolom tanggal biasa (kalender
 *        bawaan HP) di atas daftar, untuk tanggal yang jauh. Semua lewat sheet karena
 *        input tanggal transparan di atas label terbukti tidak andal di sebagian HP.
 * - "Ke hari ini" = tombol lebar setinggi jari (44px), bukan teks kecil. Meredup kalau
 *   sudah berada di periode berjalan.
 */
const NAV_BTN = 'shrink-0 w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition-all';

export default function PeriodNav({
  label, labelTestId, onPrev, onNext, prevLabel = 'Sebelumnya', nextLabel = 'Berikutnya',
  onToday, isCurrent = false, todayLabel = 'Ke hari ini', picker,
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);

  // Gulirkan pilihan aktif ke tengah setelah sheet selesai naik.
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => listRef.current?.querySelector('[data-selected]')?.scrollIntoView({ block: 'center' }), 350);
    return () => clearTimeout(t);
  }, [open]);

  const labelInner = (
    <>
      <CalendarDays className="w-4 h-4 text-accent-600 dark:text-accent-400 shrink-0" />
      <span className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm truncate" data-testid={labelTestId}>{label}</span>
      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
    </>
  );
  const labelBox = 'relative flex-1 min-w-0 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center gap-2 px-3 transition-all active:scale-[0.98]';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={onPrev} aria-label={prevLabel} className={NAV_BTN}><ChevronLeft className="w-5 h-5" /></button>

        <button onClick={() => setOpen(true)} aria-label={`Pilih periode: ${label}`} aria-haspopup="dialog" className={labelBox}>{labelInner}</button>

        <button onClick={onNext} aria-label={nextLabel} className={NAV_BTN}><ChevronRight className="w-5 h-5" /></button>
      </div>

      <button
        onClick={onToday} disabled={isCurrent} data-testid="period-today"
        className="w-full h-11 rounded-xl font-bold text-sm bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
      >
        {todayLabel}
      </button>

      {picker && (
        <Modal isOpen={open} onClose={() => setOpen(false)} sheet size="lg" maxHeight title={picker.title}>
          {picker.dateInput && (
            <div className="px-4 pb-3">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{picker.dateInput.label || 'Pilih tanggal lain'}</label>
              <input
                type="date" value={picker.dateInput.value} data-testid="period-date-input"
                onChange={(e) => { if (e.target.value) { picker.dateInput.onChange(e.target.value); setOpen(false); } }}
                className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-4 text-sm font-medium outline-none focus:border-accent-500"
              />
            </div>
          )}
          <div ref={listRef} className="px-4 pb-6 space-y-1" data-testid="period-list">
            {picker.options.map((o) => {
              const selected = o.value === picker.value;
              return (
                <button
                  key={o.value} data-selected={selected ? '' : undefined}
                  onClick={() => { picker.onChange(o.value); setOpen(false); }}
                  className={`w-full min-h-12 px-4 py-2 rounded-xl flex items-center justify-between gap-3 text-left text-sm transition-all active:scale-[0.98] ${selected ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 font-bold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <span>{o.label}</span>
                  {o.tag && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">{o.tag}</span>}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
