import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ctxAcuan, kelompokkan, makeCtx, menuInfo, tiersFor } from './hppModel'
import { rupiah } from './hppFormat'
import { Card, Chip, ChipRow, Delta, SearchBox, SectionLabel, TierBadge } from './ui'

/** Tab Menu: daftar menu per kategori. Ketuk menu untuk melihat modalnya (popup). */
export default function MenuTab({ model, onOpen, onAcuan, adaPerubahan }) {
  const [q, setQ] = useState('')
  const [kat, setKat] = useState('semua')
  const [tier, setTier] = useState(null)
  const [tutup, setTutup] = useState({})

  const info = useMemo(() => {
    const ctx = makeCtx(model)
    const acuan = ctxAcuan(model)
    return new Map(model.menu.map((m) => [m.id, { ...menuInfo(model, ctx, m), delta: ctx.menuHpp(m) - acuan.menuHpp(m) }]))
  }, [model])

  const tiers = tiersFor(model.margin)
  const hitung = Object.fromEntries(tiers.map((t) => [t, 0]))
  model.menu.forEach((m) => { hitung[info.get(m.id).tier] += 1 })

  const cari = q.trim().toLowerCase()
  const daftar = model.menu.filter((m) => (
    (kat === 'semua' || m.kategoriId === kat)
    && (!tier || info.get(m.id).tier === tier)
    && m.nama.toLowerCase().includes(cari)
  ))
  const grup = kelompokkan(daftar, model.kategoriMenu, (m) => m.kategoriId)

  return (
    <section>
      <SearchBox value={q} onChange={setQ} placeholder="Cari menu" />

      <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))` }}>
        {tiers.map((t) => (
          <button
            key={t} type="button" onClick={() => setTier(tier === t ? null : t)} aria-pressed={tier === t}
            className={`rounded-2xl border px-3 py-2 text-left transition-all active:scale-95 ${
              tier === t ? 'border-transparent bg-gradient-to-r from-accent-600 to-accent-500 text-white' : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            <span className="block text-xs font-bold opacity-80">Margin {t}</span>
            <span className="font-heading text-lg font-bold">{hitung[t]}</span>
          </button>
        ))}
      </div>

      <ChipRow>
        <Chip on={kat === 'semua'} onClick={() => setKat('semua')}>Semua {model.menu.length}</Chip>
        {model.kategoriMenu.map((k) => (
          <Chip key={k.id} on={kat === k.id} onClick={() => setKat(k.id)}>
            {k.nama} {model.menu.filter((m) => m.kategoriId === k.id).length}
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
                {g.items.map((m) => {
                  const i = info.get(m.id)
                  return (
                    <button key={m.id} type="button" onClick={() => onOpen(m.id)}
                      className="flex w-full items-center justify-between gap-3 border-t border-slate-100 py-2.5 text-left first:border-t-0 active:opacity-70">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-800">{m.nama}</span>
                        <span className="block text-xs text-slate-400">
                          Modal {rupiah(i.hpp)} · Jual {rupiah(m.hargaOutlet)} <Delta value={i.delta} className="ml-1" />
                        </span>
                      </span>
                      <span className="flex flex-none items-center gap-1.5 text-slate-300">
                        <TierBadge tier={i.tier} pct={i.pct} /><ChevronRight size={14} />
                      </span>
                    </button>
                  )
                })}
              </Card>
            )}
          </div>
        )
      })}

      {grup.length === 0 && (
        <Card padded className="text-center text-xs text-slate-400">Tidak ada menu yang cocok</Card>
      )}

      {adaPerubahan && (
        <button type="button" onClick={onAcuan}
          className="mt-1 w-full rounded-2xl bg-slate-100 py-2.5 text-xs font-bold text-slate-500 active:scale-[0.98]">
          Jadikan harga sekarang sebagai acuan
        </button>
      )}
    </section>
  )
}
