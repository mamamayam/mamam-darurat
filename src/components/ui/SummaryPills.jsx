import { formatRupiah } from '../../utils/formatters';

/**
 * SummaryPills — ringkasan nominal yang sekaligus jadi filter (ketuk untuk menyaring).
 * "Semua" selebar penuh, sisanya dua kolom ke bawah (tanpa geser samping).
 *
 * Props:
 *   items      [{ key, label, total }]   tanpa "Semua" (ditambahkan otomatis)
 *   allTotal   number                    total untuk "Semua"
 *   value      'semua' | key             onChange(key)
 *   tone       'accent' | 'red'          warna tombol terpilih (sama dengan SegmentedControl)
 *   negative   boolean                   tampilkan nominal dengan awalan "-" (pengeluaran)
 *   testIdPrefix string                  data-testid = `${prefix}-${key}`
 */

const ACTIVE = {
  accent: 'bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white border-transparent',
  red: 'bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white border-transparent',
};
const INACTIVE = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';

export default function SummaryPills({ items, allTotal, value, onChange, tone = 'accent', negative = false, testIdPrefix = 'pill' }) {
  const all = [{ key: 'semua', label: 'SEMUA', total: allTotal, wide: true }, ...items];
  return (
    <div className="grid grid-cols-2 gap-2">
      {all.map((c) => (
        <button
          key={c.key} type="button" onClick={() => onChange(c.key)} data-testid={`${testIdPrefix}-${c.key}`}
          className={`${c.wide ? 'col-span-2' : ''} min-w-0 text-left rounded-2xl px-3.5 py-2.5 border transition-all duration-300 active:scale-95 ${value === c.key ? ACTIVE[tone] ?? ACTIVE.accent : INACTIVE}`}
        >
          <p className="text-xs font-bold tracking-wide opacity-80 truncate">{c.label}</p>
          <p className="font-heading font-bold text-sm mt-0.5 truncate">{negative ? '-' : ''}{formatRupiah(c.total)}</p>
        </button>
      ))}
    </div>
  );
}
