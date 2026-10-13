import { useMemo, useState } from 'react'
import { KELOMPOK_MENU, MENU } from './data/hppData'
import { MARGIN_TARGET, buildMenu, recommendPrice, rupiah } from './hppMath'

const SEMUA = 'Semua'
const SORTS = [
  { key: 'file', label: 'Urutan file' },
  { key: 'margin-asc', label: 'Margin terkecil' },
  { key: 'margin-desc', label: 'Margin terbesar' },
]

/** Tab Menu: HPP, harga jual outlet/online, profit, margin, dan kategori HIGH/LOW per menu. */
export default function MenuTab() {
  const semua = useMemo(() => buildMenu(MENU), [])
  const [kelompok, setKelompok] = useState(SEMUA)
  const [hanyaLow, setHanyaLow] = useState(false)
  const [sort, setSort] = useState('file')
  const [open, setOpen] = useState(null)
  const [target, setTarget] = useState(35)

  const list = useMemo(() => {
    let r = semua.filter((m) => (kelompok === SEMUA || m.kelompok === kelompok) && (!hanyaLow || m.kategori === 'LOW'))
    if (sort === 'margin-asc') r = [...r].sort((a, b) => a.pct - b.pct)
    if (sort === 'margin-desc') r = [...r].sort((a, b) => b.pct - a.pct)
    return r
  }, [semua, kelompok, hanyaLow, sort])

  const high = list.filter((m) => m.kategori === 'HIGH').length
  const rata = list.length ? list.reduce((s, m) => s + m.pct, 0) / list.length : 0

  return (
    <section>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Menu', list.length], ['HIGH', high], ['LOW', list.length - high], ['Margin rata-rata', `${rata.toFixed(1)}%`]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <div className="text-slate-500">{k}</div>
            <div className="text-xl font-bold tabular-nums text-slate-800">{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[SEMUA, ...KELOMPOK_MENU].map((g) => (
          <button key={g} type="button" onClick={() => { setKelompok(g); setOpen(null) }}
            className={`rounded-full border px-3 py-1.5 transition-colors ${kelompok === g ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {g}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-slate-600">
          <input type="checkbox" checked={hanyaLow} onChange={(e) => { setHanyaLow(e.target.checked); setOpen(null) }} className="h-4 w-4 accent-orange-600" />
          Hanya LOW
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          Urutkan
          <select value={sort} onChange={(e) => { setSort(e.target.value); setOpen(null) }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Menu</th>
              <th className="px-4 py-2.5 text-right font-semibold">HPP</th>
              <th className="px-4 py-2.5 text-right font-semibold">Disarankan ({MARGIN_TARGET}%)</th>
              <th className="px-4 py-2.5 text-right font-semibold">Outlet</th>
              <th className="px-4 py-2.5 text-right font-semibold">Online</th>
              <th className="px-4 py-2.5 text-right font-semibold">Profit</th>
              <th className="px-4 py-2.5 text-right font-semibold">Margin</th>
              <th className="px-4 py-2.5 font-semibold">Kategori</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const isOpen = open === m.id
              return (
                <FragmentRow key={m.id} m={m} isOpen={isOpen} target={target} setTarget={setTarget}
                  onToggle={() => setOpen(isOpen ? null : m.id)} showGroup={kelompok === SEMUA} />
              )
            })}
            {list.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Tidak ada menu yang cocok</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-slate-500">
        Margin = profit / harga outlet. HIGH jika {MARGIN_TARGET}% ke atas. Harga online = outlet + 25%. HPP menu disalin dari file (rincian bahan per menu tidak ada di file).
      </p>
    </section>
  )
}

function FragmentRow({ m, isOpen, target, setTarget, onToggle, showGroup }) {
  const high = m.kategori === 'HIGH'
  const rec = recommendPrice(m.hpp, target)
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70" aria-expanded={isOpen}>
        <td className="px-4 py-2 text-slate-800">
          {m.nama}
          {showGroup && <span className="ml-2 text-xs text-slate-400">{m.kelompok}</span>}
        </td>
        <td className="px-4 py-2 text-right tabular-nums">{rupiah(m.hpp)}</td>
        <td className="px-4 py-2 text-right tabular-nums text-slate-500">{rupiah(m.saran)}</td>
        <td className="px-4 py-2 text-right tabular-nums">{rupiah(m.outlet)}</td>
        <td className="px-4 py-2 text-right tabular-nums">{rupiah(m.online)}</td>
        <td className="px-4 py-2 text-right tabular-nums">{rupiah(m.profit)}</td>
        <td className="px-4 py-2 text-right tabular-nums">{m.pct.toFixed(1)}%</td>
        <td className="px-4 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${high ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{m.kategori}</span>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-3 text-slate-600">
                Target margin
                <input type="range" min="20" max="70" step="1" value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-48 accent-orange-600" />
                <span className="w-10 tabular-nums font-semibold text-slate-800">{target}%</span>
              </label>
              <span className="text-slate-600">
                Rekomendasi harga jual outlet: <b className="tabular-nums text-slate-800">{rupiah(rec)}</b>
                <span className="text-slate-400"> (dibulatkan ke atas, kelipatan Rp500)</span>
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
