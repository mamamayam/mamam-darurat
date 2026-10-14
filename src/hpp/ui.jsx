import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { parseAngka, rupiah, persen } from './hppFormat'

/** Potongan tampilan bersama halaman HPP. Gaya mengikuti app (accent, slate, rounded-2xl, font-heading). */

export const WARNA_BAR = ['#f97316', '#fb923c', '#fdba74', '#94a3b8']

const TIER_STYLE = {
  HIGH: 'bg-emerald-50 text-emerald-700',
  SEDANG: 'bg-blue-50 text-blue-700',
  LOW: 'bg-amber-50 text-amber-700',
}

export function TierBadge({ tier, pct }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${TIER_STYLE[tier] || TIER_STYLE.LOW}`}>
      {pct !== undefined ? `${persen(pct)} ` : ''}{tier}
    </span>
  )
}

/** Selisih rupiah: naik (modal makin mahal) oranye, turun hijau. Tidak tampil kalau hampir nol. */
export function Delta({ value, className = '' }) {
  if (value === null || value === undefined || Math.abs(value) < 0.5) return null
  const naik = value > 0
  return (
    <span className={`font-bold tabular-nums ${naik ? 'text-accent-600' : 'text-emerald-600'} ${className}`}>
      {naik ? '▲ +' : '▼ '}{rupiah(Math.abs(value))}
    </span>
  )
}

export function Chip({ on, onClick, children, className = '' }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        on ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function ChipRow({ children }) {
  return <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">{children}</div>
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-slate-400 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/20">
      <Search size={16} aria-hidden="true" />
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent py-2.5 font-medium text-slate-800 outline-none placeholder:text-slate-400"
      />
    </label>
  )
}

export function Card({ children, className = '', padded = false }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white shadow-sm ${padded ? 'p-4' : 'px-4'} ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children, className = '' }) {
  return <div className={`text-xs font-bold uppercase tracking-wider text-slate-400 ${className}`}>{children}</div>
}

/** Satu baris daftar dengan garis pemisah. */
export function Row({ children, onClick, className = '' }) {
  const base = `flex items-center justify-between gap-3 border-t border-slate-100 py-2.5 first:border-t-0 ${className}`
  return onClick
    ? <button type="button" onClick={onClick} className={`${base} w-full text-left active:opacity-70`}>{children}</button>
    : <div className={base}>{children}</div>
}

/** Isian angka: diketik bebas, disimpan saat keluar kolom atau menekan Enter. Esc membatalkan. */
export function NumberField({ value, onCommit, ariaLabel, placeholder = '', className = '', changed = false, align = 'right', gelap = false }) {
  const [draft, setDraft] = useState(null)
  const commit = () => {
    if (draft === null) return
    const v = parseAngka(draft)
    setDraft(null)
    if (v !== null && v !== value) onCommit(v)
  }
  return (
    <input
      type="text" inputMode="decimal" aria-label={ariaLabel} placeholder={placeholder}
      value={draft ?? (value ?? '')}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur() }
      }}
      className={`w-24 rounded-xl border px-2.5 py-1.5 font-semibold tabular-nums outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${gelap ? 'border-slate-700 bg-slate-800 text-white' : `bg-white text-slate-800 ${changed ? 'border-accent-500 text-accent-700' : 'border-slate-200'}`} ${className}`}
    />
  )
}

/** Panel gelap berisi angka utama (gaya "dark-elevated" di app). */
export function Hero({ children, className = '' }) {
  return <div className={`mb-3 rounded-3xl bg-slate-900 p-4 text-white shadow-2xl ${className}`}>{children}</div>
}
export function HeroLabel({ children }) {
  return <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{children}</div>
}

/** Bar proporsi + legenda. parts: [{nama, biaya}] */
export function ProporsiBar({ parts, total, gelap = false }) {
  const aktif = parts.filter((p) => p.biaya > 0)
  return (
    <>
      <div className={`my-3 flex h-2 gap-0.5 overflow-hidden rounded-full ${gelap ? 'bg-slate-800' : 'bg-slate-100'}`} role="img" aria-label="Proporsi komponen modal">
        {aktif.map((p, i) => <div key={`${p.kind}-${p.id}-${i}`} style={{ flex: p.biaya, background: WARNA_BAR[i % WARNA_BAR.length] }} />)}
      </div>
      <div className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${gelap ? 'text-slate-300' : 'text-slate-500'}`}>
        {aktif.map((p, i) => (
          <span key={`${p.kind}-${p.id}-${i}`}>
            <span style={{ color: WARNA_BAR[i % WARNA_BAR.length] }}>●</span> {p.nama} {total > 0 ? Math.round((p.biaya / total) * 100) : 0}%
          </span>
        ))}
      </div>
    </>
  )
}

/** Lembar dari bawah (HP) / dialog tengah (laptop). Esc dan ketuk latar menutup. */
export function Sheet({ title, onClose, children, full = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div className={`w-full overflow-y-auto bg-slate-50 p-4 shadow-2xl md:max-w-xl md:rounded-3xl ${
        full ? 'h-full md:h-auto md:max-h-[92vh]' : 'max-h-[92vh] rounded-t-[28px]'
      }`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-heading text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-slate-100 text-slate-500 active:scale-95">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
