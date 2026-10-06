import { useState } from 'react';
import { FieldWrapper, base, ERROR_BORDER } from './Input';
import NominalKeypadSheet from './NominalKeypadSheet';
import { toDigits, parseNominal, formatGrouped } from './nominalMath';

/**
 * NominalInput — field angka yang membuka keypad khusus (bukan keyboard HP).
 * Pengganti drop-in untuk <Input type="number">: props & kontrak onChange sama,
 * jadi handler di pemanggil tidak perlu diubah.
 *
 *   <NominalInput label="Harga Jual" value={price} onChange={e => setPrice(e.target.value)} />
 *
 * Kontrak:
 *   value      string | number | ''   — '' = kosong
 *   onChange   (e) => void            — dipanggil dengan { target: { value } };
 *                                       value selalu string digit ('' | '0' | '12000' | '-500'),
 *                                       persis seperti e.target.value dari <input type="number">
 *
 * Props tampilan (sama dengan Input): label, error, hint, icon, variant, className, disabled, placeholder.
 *
 * Props khusus:
 *   prefix         string    — default 'Rp' (jadi ikon kiri + awalan di layar keypad); null untuk tanpa
 *   suffix         string    — mis. '%'
 *   title          string    — judul di atas layar keypad (default: label)
 *   allowNegative  boolean   — tombol ± di keypad (default false; angka minus ditolak)
 *   calculator     boolean   — ikon kalkulator di keypad (default true; matikan untuk qty / persen)
 *   max            number    — batas nilai (mis. 100 untuk persen)
 *   maxDigits      number    — default 12
 *   sheetHint      (n) => ReactNode — teks bantu di keypad, mis. Kembalian saat bayar
 *   bare           boolean   — hanya tombol pemicu + keypad, TANPA label/wrapper/styling
 *                              bawaan; tampilan 100% dari `className` pemanggil. Untuk
 *                              field yang desainnya sudah khusus (qty di keranjang,
 *                              input kecil di dalam baris, dll). Prefix tidak ditampilkan
 *                              di tombol (pemanggil yang menaruh "Rp"-nya sendiri);
 *                              suffix tetap ikut.
 */
export default function NominalInput({
  label, error, hint, icon, variant = 'default', className = '',
  value, onChange, placeholder = '0', disabled = false, readOnly = false,
  prefix = 'Rp', suffix = '', title, allowNegative = false, calculator = true,
  max = null, maxDigits, sheetHint, bare = false, ...rest
}) {
  const [open, setOpen] = useState(false);

  const digits = toDigits(value);
  const lead = icon ?? (prefix ? <span className="font-bold">{prefix}</span> : null);

  const shown = digits === ''
    ? <span className="text-slate-300 dark:text-slate-600">{placeholder}</span>
    : `${formatGrouped(parseNominal(digits))}${suffix}`;

  const sheet = open && (
    <NominalKeypadSheet
      value={digits}
      onChange={(next) => onChange?.({ target: { value: next } })}
      title={title ?? label}
      prefix={prefix ?? ''}
      suffix={suffix}
      allowNegative={allowNegative}
      calculator={calculator}
      max={max}
      maxDigits={maxDigits}
      hint={sheetHint}
      onClose={() => setOpen(false)}
    />
  );

  if (bare) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          onClick={() => { if (!readOnly) setOpen(true); }}
          className={className}
          {...rest}
        >
          {shown}
        </button>
        {sheet}
      </>
    );
  }

  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <div className="relative">
        {lead && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
            {lead}
          </span>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          onClick={() => { if (!readOnly) setOpen(true); }}
          className={`
            ${base(variant)}
            text-left truncate cursor-pointer
            ${lead ? 'pl-9' : ''}
            ${error ? ERROR_BORDER : ''}
            ${className}
          `}
          {...rest}
        >
          {shown}
        </button>
      </div>
      {sheet}
    </FieldWrapper>
  );
}
