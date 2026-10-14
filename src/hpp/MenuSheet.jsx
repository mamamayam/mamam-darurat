import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ctxAcuan, hargaMinimal, makeCtx, menuBahanKosong, menuInfo, menuParts, menusUsingBahan, resepRows } from './hppModel'
import { angka, persen, rupiah } from './hppFormat'
import { Card, Chip, ChipRow, Delta, Hero, HeroLabel, NumberField, ProporsiBar, SectionLabel, Sheet, TierBadge } from './ui'

const WARNA_TIER = { HIGH: 'text-emerald-400', SEDANG: 'text-blue-300', LOW: 'text-amber-400' }

/** Popup "Modal menu": rincian modal, komposisi, dan harga bahan yang bisa diubah langsung. */
export default function MenuSheet({ model, menuId, actions, onClose }) {
  const [catatan, setCatatan] = useState('')
  const m = model.menu.find((x) => x.id === menuId)
  const ctx = useMemo(() => makeCtx(model), [model])
  const acuan = useMemo(() => ctxAcuan(model), [model])
  if (!m) return null

  const info = menuInfo(model, ctx, m)
  const delta = info.hpp - acuan.menuHpp(m)
  const parts = menuParts(model, ctx, m)
  const kosong = menuBahanKosong(model, m)
  const minimal = info.tier === 'HIGH' ? 0 : hargaMinimal(info.hpp, model.margin.hi)

  const ubahHarga = async (bahanId, harga) => {
    const b = model.bahan[bahanId]
    const ok = await actions.ubahHarga({ bahanId, harga, catatan: `Diubah dari modal menu ${m.nama}`, sumber: 'modal_menu' })
    if (ok) setCatatan(`${b.nama} diubah ke ${rupiah(harga)}. Tercatat di riwayat harga.`)
    return ok   // false = gagal: isian tetap terbuka (lihat NumberField)
  }

  return (
    <Sheet title={m.nama} onClose={onClose}>
      <SectionLabel className="mb-1.5">Kategori menu</SectionLabel>
      <ChipRow>
        {model.kategoriMenu.map((k) => (
          <Chip key={k.id} on={m.kategoriId === k.id} onClick={() => actions.kategoriMenu(m.id, k.id)}>{k.nama}</Chip>
        ))}
      </ChipRow>

      <Hero>
        <HeroLabel>Modal (HPP)</HeroLabel>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-4xl font-bold tabular-nums">{rupiah(info.hpp)}</span>
          <Delta value={delta} className="text-xs" />
        </div>
        <ProporsiBar parts={parts} total={info.hpp} gelap />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-slate-800 px-3 py-2">
            <HeroLabel>Harga jual</HeroLabel>
            <NumberField value={m.hargaOutlet} ariaLabel="Harga jual outlet" align="left"
              onCommit={(v) => actions.hargaJual(m.id, v)} gelap className="mt-0.5 w-full !px-0 !py-0.5 !border-transparent font-heading text-lg" />
          </div>
          <div className="rounded-2xl bg-slate-800 px-3 py-2">
            <HeroLabel>Margin</HeroLabel>
            <div className={`font-heading text-lg font-bold ${WARNA_TIER[info.tier]}`}>{persen(info.pct)} {info.tier}</div>
            <div className="text-xs text-slate-400">Profit {rupiah(info.profit)} · Online {rupiah(info.online)}</div>
          </div>
        </div>
        {minimal > 0 && (
          <p className="mt-3 text-xs text-slate-300">Agar margin HIGH ({persen(model.margin.hi, 0)}), harga jual minimal {rupiah(minimal)}.</p>
        )}
      </Hero>

      {kosong.length > 0 && (
        <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Belum ada harga untuk: {kosong.join(', ')}. Modal di atas belum termasuk bahan ini.
        </p>
      )}
      {catatan && <p className="mb-2 px-1 text-xs font-semibold text-accent-600" role="status">{catatan}</p>}

      <Card>
        <SectionLabel className="pb-1 pt-3">Komposisi modal</SectionLabel>
        {parts.map((p, i) => (
          p.kind === 'bahan' ? (
            <BahanLine key={`b-${p.id}-${i}`} model={model} bahanId={p.id} qty={p.qty} biaya={p.biaya} onHarga={ubahHarga} />
          ) : p.kind === 'resep' ? (
            <ResepLine key={`r-${p.id}-${i}`} model={model} ctx={ctx} resepId={p.id} qty={p.qty} biaya={p.biaya}
              total={info.hpp} onHarga={ubahHarga} />
          ) : (
            <div key={`l-${i}`} className="flex items-start justify-between gap-3 border-t border-slate-100 py-2.5">
              <div className="pt-1">
                <div className="font-semibold text-slate-800">{p.nama}</div>
                <div className="text-xs text-slate-400">Packaging dan biaya lain yang belum diuraikan</div>
              </div>
              <NumberField value={Math.round(m.biayaLain)} ariaLabel="Biaya lain" onCommit={(v) => actions.biayaLain(m.id, v)} />
            </div>
          )
        ))}
      </Card>
      <p className="mt-2 text-xs text-slate-400">
        Ubah harga bahan langsung di sini. Perubahan tercatat di riwayat dan berlaku untuk semua menu yang memakai bahan itu.
      </p>
    </Sheet>
  )
}

/** Satu baris bahan langsung: nama, takaran, dan harga per satuan beli yang bisa diedit. */
function BahanLine({ model, bahanId, qty, biaya, onHarga, dalam = false }) {
  const b = model.bahan[bahanId]
  if (!b) return null
  const n = menusUsingBahan(model, bahanId).length
  return (
    <div className={`flex items-start justify-between gap-3 border-t border-slate-100 ${dalam ? 'py-1.5' : 'py-2.5'}`}>
      <div className="min-w-0 pt-1">
        <div className={`truncate ${dalam ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>{b.nama}</div>
        <div className="text-xs text-slate-400">
          {angka(qty)} {b.unit} · {rupiah(biaya)}{!dalam ? ` · dipakai di ${n} menu` : ''}
        </div>
      </div>
      <div className="flex-none">
        <NumberField value={b.harga} placeholder="isi harga" ariaLabel={`Harga ${b.nama}`} onCommit={(v) => onHarga(bahanId, v)}
          suffix={<span className="w-12 text-xs text-slate-400">/{b.satuan}</span>} />
      </div>
    </div>
  )
}

/** Satu baris resep yang bisa dibuka untuk melihat (dan mengubah harga) bahan penyusunnya, bertingkat. */
function ResepLine({ model, ctx, resepId, qty, biaya, total, onHarga, dalam = false, stack = [] }) {
  const [buka, setBuka] = useState(false)
  const r = model.resep[resepId]
  if (!r) return null
  const rows = buka && !stack.includes(resepId) ? resepRows(model, ctx, resepId) : []
  return (
    <div className="border-t border-slate-100">
      <button type="button" onClick={() => setBuka((v) => !v)} aria-expanded={buka}
        className={`flex w-full items-center justify-between gap-3 text-left ${dalam ? 'py-1.5' : 'py-2.5'}`}>
        <span className="min-w-0">
          <span className={`flex items-center gap-1 ${dalam ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>
            <span className="truncate">{r.nama}</span>
            <ChevronDown size={14} className={`flex-none text-slate-400 transition-transform ${buka ? 'rotate-180' : ''}`} />
          </span>
          <span className="block text-xs text-slate-400">
            Resep, {r.items.length} bahan{r.hasilQty ? ` · ${angka(qty)} ${r.hasilUnit || ''} dari batch ${angka(r.hasilQty)}` : qty !== 1 ? ` · ${angka(qty)} porsi` : ''}
          </span>
        </span>
        <span className="flex-none text-right">
          <span className="block font-semibold tabular-nums text-slate-800">{rupiah(biaya)}</span>
          {total > 0 && <span className="block text-xs text-slate-400">{Math.round((biaya / total) * 100)}%</span>}
        </span>
      </button>
      {buka && (
        <div className="mb-1.5 ml-1 border-l-2 border-slate-200 pl-3">
          {rows.map((row, i) => (
            row.kind === 'bahan'
              ? <BahanLine key={`b-${row.id}-${i}`} model={model} bahanId={row.id} qty={row.qty} biaya={row.biaya} onHarga={onHarga} dalam />
              : <ResepLine key={`r-${row.id}-${i}`} model={model} ctx={ctx} resepId={row.id} qty={row.qty} biaya={row.biaya}
                total={0} onHarga={onHarga} dalam stack={[...stack, resepId]} />
          ))}
        </div>
      )}
    </div>
  )
}
