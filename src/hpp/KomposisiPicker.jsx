import { useMemo, useState } from 'react'
import { Chip, ChipRow, SearchBox } from './ui'
import { bisaTambahSub, biayaKomponen, makeCtx } from './hppModel'
import { angka, parseAngka, rupiah } from './hppFormat'

/**
 * Panel "Tambah komponen": pilih bahan atau resep, isi takaran, tambahkan.
 * untuk = { tipe: 'menu' } atau { tipe: 'resep', resepId }. sudah = daftar kunci "b:id" / "r:id" yang sudah ada.
 * onTambah({ kind: 'bahan'|'resep', id, qty, kurangiBiayaLain }) boleh async; false = gagal (panel tetap terbuka).
 */
export default function KomposisiPicker({ model, untuk, sudah = [], biayaLain = 0, onTambah, onBatal }) {
  const [tab, setTab] = useState('bahan')
  const [q, setQ] = useState('')
  const [pilih, setPilih] = useState(null)          // { kind, id }
  const [qty, setQty] = useState('1')
  const [kurangi, setKurangi] = useState(false)
  const [proses, setProses] = useState(false)

  const ctx = useMemo(() => makeCtx(model), [model])
  const cari = q.trim().toLowerCase()
  const daftar = useMemo(() => {
    if (tab === 'bahan') {
      return model.bahanList.filter((b) => b.nama.toLowerCase().includes(cari))
        .map((b) => ({ kind: 'bahan', id: b.id, nama: b.nama, info: `per ${b.satuan}`, unit: b.unit }))
    }
    return Object.values(model.resep).filter((r) => r.nama.toLowerCase().includes(cari))
      .filter((r) => untuk.tipe !== 'resep' || bisaTambahSub(model, untuk.resepId, r.id))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      .map((r) => ({ kind: 'resep', id: r.id, nama: r.nama, info: r.grup, unit: r.hasilUnit || 'porsi' }))
  }, [model, tab, cari, untuk])

  const jumlah = parseAngka(qty)
  const biaya = pilih && jumlah !== null && jumlah > 0
    ? biayaKomponen(ctx, pilih.kind === 'bahan' ? { bahanId: pilih.id, qty: jumlah } : { resepId: pilih.id, qty: jumlah })
    : null
  const terpilih = pilih ? daftar.find((d) => d.kind === pilih.kind && d.id === pilih.id) : null
  const bisa = !!terpilih && jumlah !== null && jumlah > 0 && !proses

  const tambah = async () => {
    if (!bisa) return
    setProses(true)
    let ok
    try { ok = await onTambah({ kind: pilih.kind, id: pilih.id, qty: jumlah, kurangiBiayaLain: kurangi }) } finally { setProses(false) }
    if (ok !== false) onBatal()
  }

  return (
    <div className="hpp-reveal my-2 rounded-2xl border border-accent-200 bg-accent-50/40 p-3">
      <ChipRow>
        <Chip on={tab === 'bahan'} onClick={() => { setTab('bahan'); setPilih(null) }}>Bahan</Chip>
        <Chip on={tab === 'resep'} onClick={() => { setTab('resep'); setPilih(null) }}>Resep</Chip>
      </ChipRow>
      <SearchBox value={q} onChange={setQ} placeholder={tab === 'bahan' ? 'Cari bahan' : 'Cari resep'} />

      <ul className="mb-2 max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-white">
        {daftar.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">Tidak ada yang cocok</li>}
        {daftar.slice(0, 40).map((d) => {
          const ada = sudah.includes(`${d.kind === 'bahan' ? 'b' : 'r'}:${d.id}`)
          const on = pilih && pilih.kind === d.kind && pilih.id === d.id
          return (
            <li key={`${d.kind}-${d.id}`}>
              <button type="button" disabled={ada} onClick={() => setPilih({ kind: d.kind, id: d.id })} aria-pressed={on}
                className={`flex w-full items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-left first:border-t-0 disabled:opacity-40 ${on ? 'bg-accent-50' : ''}`}>
                <span className="min-w-0 truncate font-semibold text-slate-800">{d.nama}</span>
                <span className="flex-none text-xs text-slate-400">{ada ? 'sudah ada' : d.info}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {terpilih && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{terpilih.nama}</span>
            <input
              type="text" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Takaran komponen baru"
              onKeyDown={(e) => { if (e.key === 'Enter') tambah() }}
              className="w-24 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-right font-semibold tabular-nums outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            />
            <span className="w-10 text-xs text-slate-400">{terpilih.unit}</span>
          </div>
          <p className="text-xs text-slate-500">
            {biaya === null ? 'Isi takaran lebih dari 0.' : `Menambah modal sekitar ${rupiah(biaya)} (${angka(jumlah)} ${terpilih.unit}).`}
          </p>
          {untuk.tipe === 'menu' && biayaLain > 0 && (
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={kurangi} onChange={(e) => setKurangi(e.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-600" />
              <span>Kurangi "Biaya lain" sebesar itu (centang kalau komponen ini sebelumnya sudah termasuk di Biaya lain, supaya modal tidak dobel).</span>
            </label>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onBatal} className="flex-1 rounded-2xl bg-slate-100 py-2 text-sm font-bold text-slate-600 active:scale-[0.98]">Batal</button>
        <button type="button" onClick={tambah} disabled={!bisa}
          className="flex-1 rounded-2xl bg-gradient-to-r from-accent-600 to-accent-500 py-2 text-sm font-bold text-white shadow-lg shadow-accent-500/30 active:scale-[0.98] disabled:opacity-45 disabled:shadow-none">
          {proses ? 'Menambah…' : 'Tambah'}
        </button>
      </div>
    </div>
  )
}
