/**
 * Input / Select / Textarea — form field components dengan dark mode konsisten.
 *
 * Dua variant background field:
 *   default (default) → bg-white dark:bg-slate-900, font-medium
 *                         — field di atas Card putih biasa
 *   muted             → bg-slate-50 dark:bg-slate-950, font-semibold
 *                         — field yang butuh kesan "sunken/inset", mis. form padat
 *                           (input harian karyawan, form data diri, dll)
 *
 * Base lain yang selalu sama:
 *   border border-slate-200 dark:border-slate-700
 *   focus:border-orange-500 dark:focus:border-orange-500
 *   text-slate-800 dark:text-slate-100
 *   rounded-xl
 *
 * === Input ===
 * Props:
 *   label       string       — label di atas field
 *   error       string       — pesan error (merah, di bawah field)
 *   hint        string       — hint text abu-abu (di bawah field)
 *   icon        ReactNode    — icon di kiri (absolute positioned)
 *   variant     'default' | 'muted'   — default: 'default'
 *   disabled    boolean
 *   className   string       — class tambahan untuk <input>
 *   ...rest                  — semua props HTML input (type, value, onChange, placeholder, dll)
 *
 * Contoh:
 *   <Input label="Nama Menu" placeholder="e.g. Nasi Goreng" value={name} onChange={e => setName(e.target.value)} />
 *   <Input type="number" label="Harga" icon={<DollarSign className="w-4 h-4" />} error={errors.harga} />
 *   <Input variant="muted" label="Upah per Jam (Rp)" type="number" value={rate} onChange={...} />
 *
 * === Select ===
 * Props sama seperti Input.
 * children berisi <option> elements.
 *
 * Contoh:
 *   <Select label="Kategori" value={cat} onChange={e => setCat(e.target.value)}>
 *     <option value="">Pilih kategori</option>
 *     {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 *   </Select>
 *
 * === Textarea ===
 * Props sama, tambahan:
 *   rows  number  — default: 3
 */
import { Children, Fragment, isValidElement, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Modal from './Modal';

// ── Shared label + error wrapper ────────────────────────────────────────────
export function FieldWrapper({ label, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-accent-500 dark:text-accent-400 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Base field classes ───────────────────────────────────────────────────────
const FIELD_VARIANTS = {
  default: 'bg-white dark:bg-slate-900 font-medium',
  muted:   'bg-slate-50 dark:bg-slate-950 font-semibold',
};

export const base = (variant) => `
  w-full p-3 text-sm
  ${FIELD_VARIANTS[variant] ?? FIELD_VARIANTS.default}
  border border-slate-200 dark:border-slate-700
  text-slate-800 dark:text-slate-100
  rounded-2xl outline-none
  focus:border-accent-500 dark:focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20
  placeholder:text-slate-300 dark:placeholder:text-slate-600
  transition-all duration-300
  disabled:opacity-50 disabled:cursor-not-allowed
`;

export const ERROR_BORDER = 'border-red-400 dark:border-red-500 focus:border-red-400 dark:focus:border-red-500';

// ── Input ────────────────────────────────────────────────────────────────────
export function Input({
  label,
  error,
  hint,
  icon,
  variant = 'default',
  className = '',
  ...rest
}) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          className={`
            ${base(variant)}
            ${icon ? 'pl-9' : ''}
            ${error ? ERROR_BORDER : ''}
            ${className}
          `}
          {...rest}
        />
      </div>
    </FieldWrapper>
  );
}

// ── Select ───────────────────────────────────────────────────────────────────
// Dropdown = tombol yang membuka bottom sheet (gaya sama dengan sheet Periode di FilterBar),
// BUKAN <select> bawaan browser, supaya semua pilihan di app tampil seragam.
// API tetap seperti <select>: children <option value>, value, onChange(e) dengan e.target.value,
// disabled, id, aria-label, data-testid. Tambahan: `title` (judul sheet; default label / aria-label),
// `bare` (tanpa pembungkus label; className dipakai apa adanya, untuk kontrol mungil di baris/header).
const SHEET_OPT_BASE = 'w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 disabled:opacity-40';
const SHEET_OPT_ON = 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400';
const SHEET_OPT_OFF = 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800';

/** Kumpulkan <option> dari children (termasuk Fragment, array hasil .map, dan `cond && <option/>`). */
export function collectSelectOptions(children, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'option') {
      const label = Children.toArray(child.props.children).join('');
      out.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) });
    } else if (child.type === Fragment) {
      collectSelectOptions(child.props.children, out);
    }
  });
  return out;
}

export function Select({
  label,
  error,
  hint,
  variant = 'default',
  className = '',
  children,
  value,
  onChange,
  disabled,
  id,
  title,
  bare = false,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const options = collectSelectOptions(children);
  const current = String(value ?? '');
  const selected = options.find(o => o.value === current);
  const pick = (o) => {
    setOpen(false);
    if (o.value !== current) onChange?.({ target: { value: o.value, id, name: rest.name } });
  };

  const trigger = (
    <button
      type="button" id={id} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
      onClick={() => setOpen(true)}
      className={bare
        ? `flex items-center justify-between gap-1.5 text-left disabled:opacity-50 ${className}`
        : `${base(variant)} cursor-pointer flex items-center justify-between gap-2 text-left ${error ? ERROR_BORDER : ''} ${className}`}
      {...rest}
    >
      <span className="truncate">{selected ? selected.label : ''}</span>
      <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
    </button>
  );

  const sheet = (
    <Modal isOpen={open} onClose={() => setOpen(false)} title={title || label || rest['aria-label'] || 'Pilih'} size="md" sheet maxHeight>
      <div className="px-2 pb-3" role="listbox">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <button key={o.value} type="button" role="option" aria-selected={active} disabled={o.disabled}
              onClick={() => pick(o)} className={`${SHEET_OPT_BASE} ${active ? SHEET_OPT_ON : SHEET_OPT_OFF}`}>
              <span className="text-left">{o.label}</span>
              {active && <Check className="w-4 h-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    </Modal>
  );

  if (bare) return <>{trigger}{sheet}</>;
  return <FieldWrapper label={label} error={error} hint={hint}>{trigger}{sheet}</FieldWrapper>;
}

// ── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({
  label,
  error,
  hint,
  rows = 3,
  variant = 'default',
  className = '',
  ...rest
}) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <textarea
        rows={rows}
        className={`
          ${base(variant)}
          resize-none
          ${error ? ERROR_BORDER : ''}
          ${className}
        `}
        {...rest}
      />
    </FieldWrapper>
  );
}

// ── Default export untuk kasus paling umum ───────────────────────────────────
export default Input;
