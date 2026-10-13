import { useMemo, useState } from 'react'
import { BAHAN } from './data/hppData'
import { rupiah } from './hppMath'

/** Tab Bahan: database bahan baku dan harga beli (harga per 27/11/2025). */
export default function BahanTab() {
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return BAHAN.filter(([, nama]) => nama.toLowerCase().includes(s))
  }, [q])
  const kosong = BAHAN.filter((b) => b[4] === null).length

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bahan"
          aria-label="Cari bahan"
          className="w-full sm:w-72 rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20" />
        <p className="text-slate-500">{rows.length} dari {BAHAN.length} bahan, {kosong} belum ada harga. Harga per 27/11/2025.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="w-12 px-4 py-2.5 font-semibold">No</th>
              <th className="px-4 py-2.5 font-semibold">Nama bahan</th>
              <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
              <th className="px-4 py-2.5 font-semibold">Satuan</th>
              <th className="px-4 py-2.5 font-semibold text-right">Harga beli</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([no, nama, qty, satuan, harga]) => (
              <tr key={no} className="border-t border-slate-100 hover:bg-slate-50/70">
                <td className="px-4 py-2 text-slate-400 tabular-nums">{no}</td>
                <td className="px-4 py-2 text-slate-800">{nama}</td>
                <td className="px-4 py-2 text-right tabular-nums">{qty ?? '-'}</td>
                <td className="px-4 py-2 text-slate-600">{satuan ?? '-'}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {harga === null
                    ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Belum diisi</span>
                    : rupiah(harga)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Tidak ada bahan yang cocok</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
