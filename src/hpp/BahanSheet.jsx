import { useMemo, useState } from 'react'
import { dampakHarga, tierOf } from './hppModel'
import { angka, parseAngka, persen, rupiah, tanggal } from './hppFormat'
import { Card, Chip, ChipRow, Delta, Hero, HeroLabel, SectionLabel, Sheet, TierBadge } from './ui'

/** Popup bahan: ubah harga, dampaknya ke menu, dan riwayat perubahan harga (seperti riwayat transaksi). */
export default function BahanSheet({ model, bahanId, actions, perubahan, onClose }) {
  const [nilai, setNilai] = useState('')
  const [catatan, setCatatan] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)
  const b = model.bahan[bahanId]

  // Dampak perubahan terakhir hanya ditampilkan untuk bahan yang baru saja diubah di sesi ini.
  const aktif = perubahan && perubahan.bahanId === bahanId && perubahan.sebelum !== null && perubahan.sebelum !== b?.harga ? perubahan : null
  const dampak = useMemo(
    () => (b ? dampakHarga(model, bahanId, aktif ? aktif.sebelum : b.harga) : { rows: [], ganti: 0 }),
    [model, bahanId, b, aktif],
  )
  if (!b) return null

  const riwayat = model.riwayat[bahanId] || []
  const baru = parseAngka(nilai)
  const bisaSimpan = baru !== null && baru !== b.harga && !menyimpan

  const simpan = async () => {
    if (!bisaSimpan) return
    setMenyimpan(true)
    const ok = await actions.ubahHarga({ bahanId, harga: baru, catatan: catatan.trim(), sumber: 'manual' })
    setMenyimpan(false)
    if (ok) { setNilai(''); setCatatan('') }
  }
  const cepat = (p) => { if (b.harga !== null) setNilai(String(Math.round(b.harga * (1 + p / 100)))) }

  return (
    <Sheet title={b.nama} onClose={onClose}>
      <SectionLabel className="mb-1.5">Kategori bahan</SectionLabel>
      <ChipRow>
        {model.kategoriBahan.map((k) => (
          <Chip key={k.id} on={b.kategoriId === k.id} onClick={() => actions.kategoriBahan(b.id, k.id)}>{k.nama}</Chip>
        ))}
      </ChipRow>

      <Hero className={aktif ? '' : 'pb-3'}>
        {aktif ? (
          <>
            <HeroLabel>Dampak perubahan harga</HeroLabel>
            <div className="mt-0.5 font-heading text-lg font-bold">{rupiah(aktif.sebelum)} → {rupiah(aktif.sesudah)}</div>
            <div className="text-xs text-slate-300">
              {dampak.rows.length} menu terdampak{dampak.ganti ? `, ${dampak.ganti} berubah kategori margin` : ', tidak ada yang berubah kategori'}
            </div>
          </>
        ) : (
          <>
            <HeroLabel>Harga sekarang</HeroLabel>
            <div className="font-heading text-3xl font-bold tabular-nums">{b.harga === null ? 'Belum diisi' : rupiah(b.harga)}</div>
            <div className="text-xs text-slate-400">per {b.satuan} · isi {angka(b.isi)} {b.unit}</div>
          </>
        )}
      </Hero>

      <Card padded className="mb-3">
        <SectionLabel className="mb-2">Ubah harga per {b.satuan}</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text" inputMode="decimal" value={nilai} onChange={(e) => setNilai(e.target.value)} aria-label="Harga baru"
            placeholder={b.harga === null ? 'Isi harga' : String(b.harga)}
            onKeyDown={(e) => { if (e.key === 'Enter') simpan() }}
            className="w-32 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-semibold tabular-nums outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
          />
          {[-10, 10, 20].map((p) => (
            <button key={p} type="button" onClick={() => cepat(p)} disabled={b.harga === null}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 disabled:opacity-40">
              {p > 0 ? '+' : ''}{p}%
            </button>
          ))}
        </div>
        {baru !== null && b.harga ? (
          <p className="mt-1.5 text-xs">
            {baru === b.harga
              ? <span className="text-slate-400">Sama dengan harga sekarang</span>
              : <span className={baru > b.harga ? 'font-bold text-accent-600' : 'font-bold text-emerald-600'}>
                {baru > b.harga ? 'Naik' : 'Turun'} {persen(Math.abs(((baru - b.harga) / b.harga) * 100))} ({baru > b.harga ? '+' : '-'}{rupiah(Math.abs(baru - b.harga))})
              </span>}
          </p>
        ) : null}
        <input
          type="text" value={catatan} onChange={(e) => setCatatan(e.target.value)} aria-label="Catatan"
          placeholder="Catatan (opsional), mis. harga pasar naik"
          className="my-2.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
        />
        <button type="button" onClick={simpan} disabled={!bisaSimpan}
          className="w-full rounded-2xl bg-gradient-to-r from-accent-600 to-accent-500 py-2.5 font-bold text-white shadow-lg shadow-accent-500/30 transition-transform active:scale-[0.98] disabled:opacity-45 disabled:shadow-none">
          {menyimpan ? 'Menyimpan…' : 'Simpan harga baru'}
        </button>
      </Card>

      <SectionLabel className="mb-1.5 px-0.5">Menu terdampak · {dampak.rows.length}</SectionLabel>
      <Card className="mb-3">
        {dampak.rows.length === 0 && <p className="py-3 text-xs text-slate-400">Belum dipakai oleh menu mana pun.</p>}
        {dampak.rows.map((r) => (
          <div key={r.menu.id} className="flex items-start justify-between gap-3 border-t border-slate-100 py-2.5 first:border-t-0">
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-800">{r.menu.nama}</div>
              <div className="text-xs text-slate-400">{model.kategoriMenu.find((k) => k.id === r.menu.kategoriId)?.nama || 'Lainnya'}</div>
            </div>
            <div className="flex-none text-right">
              <div className="font-semibold tabular-nums text-slate-800">
                {aktif ? `${rupiah(r.sebelum.hpp)} → ` : ''}{rupiah(r.sesudah.hpp)}
              </div>
              <div className="flex items-center justify-end gap-1 text-xs tabular-nums text-slate-400">
                {aktif && <span>{persen(r.sebelum.pct)} →</span>}
                <TierBadge tier={tierOf(r.sesudah.pct, model.margin)} pct={r.sesudah.pct} />
              </div>
              {aktif && <div className="text-xs"><Delta value={r.selisih} /></div>}
              {r.ganti && <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Berubah kategori</span>}
            </div>
          </div>
        ))}
      </Card>

      <SectionLabel className="mb-1.5 px-0.5">Riwayat harga</SectionLabel>
      <Card className="pl-6">
        {riwayat.length === 0 && <p className="py-3 text-xs text-slate-400">Belum ada riwayat.</p>}
        <ol className="relative my-2 border-l-2 border-slate-200 pl-4">
          {riwayat.map((e, i) => {
            const sebelum = e.hargaSebelum ?? riwayat[i + 1]?.harga ?? null
            const d = sebelum ? ((e.harga - sebelum) / sebelum) * 100 : null
            return (
              <li key={e.id} className="relative py-2">
                <span className="absolute -left-[23px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-accent-500 bg-white" aria-hidden="true" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800">
                      {tanggal(e.pada)}{e.catatan ? <span className="font-medium text-slate-400"> · {e.catatan}</span> : null}
                    </div>
                    <div className="text-xs text-slate-400">
                      {sebelum === null ? 'Harga awal' : `${d > 0 ? 'Naik' : 'Turun'} ${persen(Math.abs(d))} dari ${rupiah(sebelum)}`}
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div className="font-bold tabular-nums text-slate-800">{rupiah(e.harga)}</div>
                    {sebelum !== null && <div className="text-xs"><Delta value={e.harga - sebelum} /></div>}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </Card>
    </Sheet>
  )
}
