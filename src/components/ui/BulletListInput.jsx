import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldWrapper } from './Input';

/**
 * BulletListInput — daftar poin-poin. Tiap poin satu baris input; tekan Enter
 * untuk poin baru (fokus pindah otomatis), Backspace di poin kosong untuk
 * menghapusnya. Tempel teks multi-baris (mis. dari catatan belanja) langsung
 * dipecah jadi poin-poin.
 *
 * Kontrak: value = array string (minimal 1 elemen, boleh ['']), onChange(array).
 * Pemanggil yang menyimpan: items.map(trim).filter(Boolean).join('\n').
 *
 *   <BulletListInput label="Detail" value={items} onChange={setItems} />
 */
const stripBullet = (line) => line.replace(/^\s*(?:[-•*]\s+|\d+[.)]\s+)/, '').trim();

export default function BulletListInput({
  label, value, onChange, hint = 'Tekan Enter untuk poin baru.',
  placeholder = 'Opsional', nextPlaceholder = 'Poin berikutnya',
}) {
  const items = value && value.length ? value : [''];
  const refs = useRef([]);
  const pendingFocus = useRef(null);

  // Pindahkan fokus setelah render yang menambah/menghapus poin.
  useEffect(() => {
    if (pendingFocus.current == null) return;
    const el = refs.current[pendingFocus.current];
    pendingFocus.current = null;
    if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch { /* abaikan */ } }
  });

  const setAt = (i, text) => onChange(items.map((t, idx) => (idx === i ? text : t)));

  const addAfter = (i) => {
    if (!items[i].trim()) return;                     // jangan bikin poin kosong berderet
    pendingFocus.current = i + 1;
    onChange([...items.slice(0, i + 1), '', ...items.slice(i + 1)]);
  };

  const removeAt = (i) => {
    if (items.length === 1) { onChange(['']); return; }
    pendingFocus.current = Math.max(0, i - 1);
    onChange(items.filter((_, idx) => idx !== i));
  };

  const handleKeyDown = (e, i) => {
    if (e.key === 'Enter') { e.preventDefault(); addAfter(i); }
    else if (e.key === 'Backspace' && items[i] === '' && items.length > 1) { e.preventDefault(); removeAt(i); }
  };

  const handlePaste = (e, i) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/\r?\n/.test(text)) return;                  // satu baris: biarkan paste biasa
    e.preventDefault();
    const lines = text.split(/\r?\n/).map(stripBullet).filter(Boolean);
    if (lines.length === 0) return;
    const keepCurrent = items[i].trim() ? [items[i]] : [];
    const next = [...items.slice(0, i), ...keepCurrent, ...lines, ...items.slice(i + 1)];
    pendingFocus.current = i + keepCurrent.length + lines.length - 1;
    onChange(next);
  };

  return (
    <FieldWrapper label={label} hint={hint}>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 space-y-0.5 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/20 transition-all duration-300">
        {items.map((item, i) => (
          // <form> per baris: tombol Enter/"Next" di keyboard HP yang tidak mengirim
          // keydown "Enter" tetap memicu submit -> poin baru.
          <form key={i} onSubmit={(e) => { e.preventDefault(); addAfter(i); }} className="flex items-center gap-2.5">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0 ml-0.5" />
            <input
              ref={(el) => { refs.current[i] = el; }}
              value={item}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={(e) => handlePaste(e, i)}
              enterKeyHint="next"
              autoComplete="off"
              placeholder={i === 0 ? placeholder : nextPlaceholder}
              data-testid="bullet-input"
              className="flex-1 min-w-0 bg-transparent py-2 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
            {items.length > 1 && (
              <button type="button" onClick={() => removeAt(i)} aria-label="Hapus poin" className="p-1 rounded-full text-slate-300 dark:text-slate-600 hover:text-red-500 active:scale-90 transition-all shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        ))}
      </div>
    </FieldWrapper>
  );
}
