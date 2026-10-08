import { Settings2 } from 'lucide-react';
import { Select } from './ui';

/**
 * CategorySelect — dropdown kategori + ikon gerigi "Kelola Kategori" (dipakai form
 * Pengeluaran dan Penggajian). Kategori baru ditambah lewat Kelola Kategori. Nilai lama
 * pada catatan yang sedang diedit tetap muncul di pilihan walau sudah tidak ada di daftar,
 * supaya tidak hilang diam-diam.
 */
export default function CategorySelect({ value, onChange, options, onManage, label = 'Kategori', placeholder = 'Pilih kategori' }) {
  const extra = value && !options.includes(value) ? [value] : [];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
        <button type="button" onClick={onManage} aria-label="Kelola Kategori" title="Kelola Kategori"
          className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 active:scale-90 transition-all"><Settings2 className="w-3.5 h-3.5" /></button>
      </div>
      <Select value={value} onChange={e => onChange(e.target.value)} data-testid="category-select">
        <option value="">{placeholder}</option>
        {[...options, ...extra].map(o => <option key={o} value={o}>{o}</option>)}
      </Select>
    </div>
  );
}
