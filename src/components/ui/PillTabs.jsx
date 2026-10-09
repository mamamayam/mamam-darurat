import { pillIndex, pillIndicatorStyle } from './pillTabsMath';

/**
 * PillTabs — tab berbentuk satu pil. Semua opsi ada di dalam satu pil putih; yang aktif
 * ditandai indikator berwarna yang BERGESER halus ke tab yang dipilih (bukan tiap tombol
 * berganti warna sendiri-sendiri).
 *
 * Untuk perpindahan tab / filter. Untuk toggle semantik berwarna per opsi (hijau/merah,
 * mis. Masuk-Libur, Penghasilan-Potongan) tetap pakai SegmentedControl.
 *
 * Semua tab sama lebar. Warna indikator ada di INDICATOR; ubah di sini kalau mau ganti.
 * Teks tab yang baru aktif berubah putih dengan jeda singkat (delay-100), supaya baru putih
 * setelah indikator menutupinya dan tidak sempat "hilang" di atas latar putih saat bergeser.
 *
 * Props:
 *   options   Array<{ value, label }>
 *   value     value yang sedang aktif
 *   onChange  (value) => void
 *   size      'sm' | 'md'   (default: 'md')   sm → py-2 text-xs   md → py-2.5 text-sm
 *   className string — class tambahan untuk wrapper
 */

const INDICATOR = `
  bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600
  shadow-[0_4px_14px_rgba(var(--color-accent-500),0.3)]
`;

const SIZES = {
  sm: 'py-2 text-xs',
  md: 'py-2.5 text-sm',
};

export default function PillTabs({
  options = [],
  value,
  onChange,
  size = 'md',
  className = '',
}) {
  const count = options.length;
  const index = pillIndex(options, value);

  return (
    <div
      role="tablist"
      className={`relative grid rounded-full bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800 shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:shadow-none ${className}`}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {index >= 0 && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${INDICATOR}`}
          style={pillIndicatorStyle(index, count)}
        />
      )}
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`
              relative z-10 rounded-full font-semibold transition-colors duration-200 motion-reduce:transition-none
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50
              ${SIZES[size] ?? SIZES.md}
              ${isActive ? 'text-white delay-100' : 'text-slate-500 dark:text-slate-400'}
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
