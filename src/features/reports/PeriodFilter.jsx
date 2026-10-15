import { Card, Input, PillTabs } from '../../components/ui';
import PeriodNav from '../../components/PeriodNav';
import {
  localDateString, shiftMonthKey, shiftDate, monthLabel, dayLabel,
  monthOptions, dayOptions, lastDaysRange,
} from './reportsMath';

/**
 * PeriodFilter — filter periode Laporan (dipakai SEMUA tab supaya formatnya sama).
 * Pola navigasinya sama dengan Absensi/Penggajian (PeriodNav):
 *   - Bulanan : [<] [ Oktober 2026 ▾ ] [>] + "Ke bulan ini"; ketuk label = daftar bulan
 *   - Harian  : [<] [ Kam, 15 Okt 2026 ▾ ] [>] + "Ke hari ini"; sheet punya kalender untuk tanggal jauh
 *   - Semua   : tanpa navigasi
 *   - Rentang : dua tanggal bebas + tombol cepat (7/30/90 hari terakhir)
 * Tombol > mati di periode berjalan (belum ada data masa depan).
 *
 * `value` = { mode, month, day, start, end } (diubah lewat onChange(nextValue));
 * hasilnya diterjemahkan jadi rentang tanggal oleh reportRange (reportsMath).
 */
export const MODE_OPTIONS = [
  { value: 'bulan', label: 'Bulanan' }, { value: 'hari', label: 'Harian' },
  { value: 'semua', label: 'Semua' }, { value: 'rentang', label: 'Rentang' },
];
const QUICK = [['7 hari terakhir', 7], ['30 hari terakhir', 30], ['3 bulan terakhir', 90]];
const CHIP = 'h-10 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all duration-300 active:scale-95';

export default function PeriodFilter({ value, onChange, today = localDateString() }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const { mode, month, day, start, end } = value;

  const isMonth = mode === 'bulan';
  const isCurrent = isMonth ? month === today.slice(0, 7) : day === today;
  const goToday = () => set(isMonth ? { month: today.slice(0, 7) } : { day: today });

  return (
    <Card className="space-y-3">
      <PillTabs size="sm" value={mode} onChange={(m) => set({ mode: m })} options={MODE_OPTIONS} />

      {(isMonth || mode === 'hari') && (
        <PeriodNav
          label={isMonth ? monthLabel(month) : dayLabel(day)} labelTestId="period-label"
          onPrev={() => set(isMonth ? { month: shiftMonthKey(month, -1) } : { day: shiftDate(day, -1) })}
          onNext={() => set(isMonth ? { month: shiftMonthKey(month, 1) } : { day: shiftDate(day, 1) })}
          nextDisabled={isCurrent}
          onToday={goToday} isCurrent={isCurrent}
          todayLabel={isMonth ? 'Ke bulan ini' : 'Ke hari ini'}
          picker={isMonth
            ? { title: 'Pilih Bulan', value: month, onChange: (v) => set({ month: v }), options: monthOptions(today) }
            : {
              title: 'Pilih Hari', value: day, onChange: (v) => set({ day: v }), options: dayOptions(today),
              dateInput: { value: day, max: today, onChange: (v) => set({ day: v }) },
            }}
        />
      )}

      {mode === 'semua' && <p className="text-xs text-center text-slate-400">Menampilkan semua data tanpa batas tanggal.</p>}

      {mode === 'rentang' && (
        <>
          <div className="flex items-center gap-2">
            <Input type="date" value={start} max={end || today} onChange={e => set({ start: e.target.value })} />
            <span className="text-slate-400">–</span>
            <Input type="date" value={end} min={start || undefined} max={today} onChange={e => set({ end: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map(([label, n]) => (
              <button key={n} type="button" className={CHIP} onClick={() => onChange({ ...value, ...lastDaysRange(n, today) })}>{label}</button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
