import { useMemo, useState } from 'react'
import { RESEP } from './data/hppData'
import { angka, computeRecipes, rupiah } from './hppMath'

const GRUP = ['Semua', ...new Set(RESEP.map((r) => r.grup))]

/** Tab Resep: komposisi bahan dan HPP per porsi. Saos/sambal adalah batch yang dipakai lagi di Topping. */
export default function ResepTab() {
  const hitung = useMemo(() => computeRecipes(RESEP), [])
  const [grup, setGrup] = useState('Semua')
  const [open, setOpen] = useState(() => new Set())
  const list = RESEP.filter((r) => grup === 'Semua' || r.grup === grup)
  const toggle = (id) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOpen = list.length > 0 && list.every((r) => open.has(r.id))
  const toggleAll = () => setOpen((prev) => {
    const n = new Set(prev)
    list.forEach((r) => (allOpen ? n.delete(r.id) : n.add(r.id)))
    return n
  })

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {GRUP.map((g) => (
          <button key={g} type="button" onClick={() => setGrup(g)}
            className={`rounded-full border px-3 py-1.5 transition-colors ${grup === g ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {g}
          </button>
        ))}
        <button type="button" onClick={toggleAll} className="ml-auto rounded-full px-3 py-1.5 text-slate-500 hover:bg-slate-100">
          {allOpen ? 'Tutup semua' : 'Buka semua'}
        </button>
      </div>

      <div className="space-y-3">
        {list.map((r) => {
          const c = hitung[r.id]
          const isOpen = open.has(r.id)
          return (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button type="button" onClick={() => toggle(r.id)} aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <div>
                  <div className="font-semibold text-slate-800">{r.nama}</div>
                  <div className="text-slate-500">
                    {r.grup}{r.batch ? `, batch ${angka(r.batch)} gr` : ''}{c.sheetTotal === null ? ', daftar bahan tanpa total' : ''}
                  </div>
                </div>
                <div className="text-right">
                  {c.sheetTotal !== null && <div className="font-semibold tabular-nums text-slate-800">{rupiah(c.total)}</div>}
                  <div className="text-slate-400">{isOpen ? 'Tutup' : `${c.rows.length} bahan`}</div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Bahan</th>
                          <th className="px-4 py-2 text-right font-semibold">Komposisi</th>
                          <th className="px-4 py-2 text-right font-semibold">Pembelian</th>
                          <th className="px-4 py-2 text-right font-semibold">Harga</th>
                          <th className="px-4 py-2 text-right font-semibold">HPP per porsi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.rows.map((x, i) => (
                          <tr key={`${x.nama}-${i}`} className="border-t border-slate-100">
                            <td className="px-4 py-2 text-slate-800">
                              {x.nama}
                              {x.refNama && <span className="ml-2 text-xs text-accent-600">dari resep {x.refNama}</span>}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">{angka(x.komposisi)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{angka(x.pembelian)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{x.harga ? rupiah(x.harga) : '-'}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{rupiah(x.hpp)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {c.sheetTotal !== null && (
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                            <td className="px-4 py-2" colSpan={4}>Total{c.batch ? ` (batch ${angka(c.batch)} gr)` : ''}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{rupiah(c.total)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  {c.selisih !== null && Math.abs(c.selisih) > 2 && (
                    <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-amber-800">
                      Total di file {rupiah(c.sheetTotal)}, hitungan baris {rupiah(c.total)} (selisih {rupiah(c.selisih)}). Cek apakah baris terakhir ikut dijumlah di file.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
