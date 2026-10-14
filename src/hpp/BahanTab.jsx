import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { kelompokkan, menusUsingBahan, perubahanTerakhir } from './hppModel'
import { persen, rupiah, tanggal } from './hppFormat'
import { Card, Chip, ChipRow, SearchBox, SectionLabel } from './ui'

/** Tab Harga bahan: bahan baku per kategori. Ketuk bahan untuk ubah harga, lihat dampak dan riwayat. */
export default function BahanTab({ model, onOpen }) {
  const [q, setQ] = useState('')
  const [kat, setKat] = useState('semua')
  const [tutup, setTutup] = useState({})

  const dipakai = useMemo(
    () => new Map(model.bahanList.map((b) => [b.id, menusUsingBahan(model, b.id).length])),
    [model],
  )
  const cari = q.trim().toLowerCase()
  const daftar = model.bahanList.filter((b) => (kat === 'semua' || b.kategoriId === kat) && b.nama.toLowerCase().includes(cari))
  const grup = kelompokkan(daftar, model.kategoriBahan, (b) => b.kategoriId)
  const kosong = model.bahanList.filter((b) => b.harga === null).length

  return (
    <section>
      <SearchBox value={q} onChange={setQ} placeholder="Cari bahan" />
      <ChipRow>
        <Chip on={kat === 'semua'} onClick={() => setKat('semua')}>Semua {model.bahanList.length}</Chip>
        {model.kategoriBahan.map((k) => (
          <Chip key={k.id} on={kat === k.id} onClick={() => setKat(k.id)}>
            {k.nama} {model.bahanList.filter((b) => b.kategoriId === k.id).length}
          </Chip>
        ))}
      </ChipRow>

      {grup.map((g) => {
        const lipat = tutup[g.id ?? 'x']
        return (
          <div key={g.id ?? 'x'} className="mb-3">
            <button type="button" onClick={() => setTutup((s) => ({ ...s, [g.id ?? 'x']: !s[g.id ?? 'x'] }))}
              aria-expanded={!lipat} className="mb-1.5 flex w-full items-center justify-between px-0.5">
              <SectionLabel>{g.nama} · {g.items.length}</SectionLabel>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${lipat ? '-rotate-90' : ''}`} />
            </button>
            {!lipat && (
              <Card>
                {g.items.map((b) => {
                  const p = perubahanTerakhir(model, b.id)
                  const n = dipakai.get(b.id)
                  return (
                    <button key={b.id} type="button" onClick={() => onOpen(b.id)}
                      className="flex w-full items-center justify-between gap-3 border-t border-slate-100 py-2.5 text-left first:border-t-0 active:opacity-70">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-800">{b.nama}</span>
                        <span className="block text-xs text-slate-400">per {b.satuan} · {n ? `dipakai di ${n} menu` : 'belum dipakai menu'}</span>
                      </span>
                      <span className="flex flex-none items-center gap-1.5 text-slate-300">
                        <span className="text-right">
                          {b.harga === null
                            ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Belum diisi</span>
                            : <span className="block font-bold tabular-nums text-slate-800">{rupiah(b.harga)}</span>}
                          <span className="block text-xs">
                            {p
                              ? <><span className={p.persen > 0 ? 'font-bold text-accent-600' : 'font-bold text-emerald-600'}>{p.persen > 0 ? '▲' : '▼'} {persen(Math.abs(p.persen))}</span> <span className="text-slate-400">· {tanggal(p.pada)}</span></>
                              : <span className="text-slate-400">Harga awal</span>}
                          </span>
                        </span>
                        <ChevronRight size={14} />
                      </span>
                    </button>
                  )
                })}
              </Card>
            )}
          </div>
        )
      })}

      {grup.length === 0 && <Card padded className="text-center text-xs text-slate-400">Tidak ada bahan yang cocok</Card>}
      {kosong > 0 && kat === 'semua' && !cari && (
        <p className="px-1 text-xs text-slate-400">{kosong} bahan belum ada harganya. Ketuk bahannya untuk mengisi.</p>
      )}
    </section>
  )
}
