import { useState } from 'react';
import { ChevronRight, Pencil, Trash2, Share2, Lock } from 'lucide-react';
import { Badge, Button, NominalInput } from '../../components/ui';
import { fmtDay, fmtHM, STATUS_LABEL, STATUS_VARIANT } from './payrollReport';

/**
 * PayrollReport — isi detail gaji satu karyawan, untuk periode MINGGUAN dan BULANAN (tampilan sama).
 * Ringkas dulu, rinciannya dibuka sendiri-sendiri (tanpa tab):
 *  - Total Pendapatan, lalu Pengurangan (Kasbon, Potongan). Saldo awal ikut ke sisi yang benar:
 *    toko berutang = "Sisa Bulan Lalu (Kurang Bayar)" di Pendapatan; karyawan berutang = "Hutang Bulan Lalu" di Pengurangan.
 *  - Saldo Awal Bulan (khusus bulanan): pilih JENIS (toko / karyawan berutang) + nominal positif, tanpa tanda minus.
 *  - Rincian Harian: tabel Keterangan | Pemasukan (+) | Pengeluaran (-), dikelompokkan per tanggal beserta jam kerja.
 *    Potongan bisa diubah (membuka form Potongan Catat Cepat) atau dihapus; Tambahan hanya dihapus.
 * Data berasal dari buildPayrollReport (payrollReport.js).
 */

const COLS = 'grid grid-cols-[1fr_5.25rem_5.25rem] gap-1.5';
const KINDS = [
  { value: 'toko', label: 'Toko berutang', hint: 'menambah gaji' },
  { value: 'karyawan', label: 'Karyawan berutang', hint: 'mengurangi gaji' },
];

function Section({ title, value, valueClass = '', open, onToggle, testId, children }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <button type="button" onClick={onToggle} aria-expanded={open} data-testid={testId}
        className="w-full flex items-center gap-2 py-3.5 text-left active:opacity-70">
        <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        <span className="font-bold text-slate-800 dark:text-slate-100 shrink-0">{title}</span>
        <span className={`ml-auto font-bold shrink-0 ${valueClass}`}>{value}</span>
      </button>
      {open && <div className="pb-3 pl-6">{children}</div>}
    </div>
  );
}

const Row = ({ k, v, dim }) => (
  <div className={`flex justify-between gap-3 py-1 ${dim ? 'opacity-50' : ''}`}>
    <span className="text-slate-500 dark:text-slate-400">{k}</span>
    <span className="font-bold text-slate-800 dark:text-slate-100 shrink-0">{v}</span>
  </div>
);

export default function PayrollReport({
  report, isLocked, formatRupiah, dayFlags, notice,
  onEditDay, onEditDeduction, onDeleteItem,
  canEditOpening, openingForm, onOpeningChange, onSaveOpening, busy, onShare,
  initialOpen = {},   // bagian yang terbuka sejak awal (default semua tertutup; dipakai tes)
}) {
  const [open, setOpen] = useState({ pend: false, cut: false, sal: false, hari: false, ...initialOpen });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const { opening } = report;
  const openingValue = opening.kind ? `${opening.kind === 'toko' ? '+' : '-'}${formatRupiah(opening.amount)}` : formatRupiah(0);
  const money = (n, tone) => (n
    ? <span className={`text-right font-medium ${tone}`}>{formatRupiah(n)}</span>
    : <span className="text-right text-slate-300 dark:text-slate-600">-</span>);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-baseline gap-3" data-testid="gaji-bersih">
        <span className="font-bold text-base text-slate-800 dark:text-slate-100">Gaji Bersih</span>
        <span className={`font-heading font-bold text-xl ${report.net < 0 ? 'text-red-500' : 'text-accent-600 dark:text-accent-400'}`}>{formatRupiah(report.net)}</span>
      </div>

      {notice}

      <div>
        <Section title="Total Pendapatan" value={formatRupiah(report.totalIncome)} open={open.pend} onToggle={() => toggle('pend')} testId="sec-pendapatan">
          <div className="text-sm">{report.income.map((r) => <Row key={r.key} k={r.label} v={formatRupiah(r.amount)} dim={r.amount === 0} />)}</div>
        </Section>

        <Section title="Pengurangan" value={formatRupiah(-report.totalDeductions)} valueClass={report.totalDeductions > 0 ? 'text-red-500' : ''}
          open={open.cut} onToggle={() => toggle('cut')} testId="sec-pengurangan">
          <div className="text-sm">{report.cuts.map((r) => <Row key={r.key} k={r.label} v={formatRupiah(-r.amount)} dim={r.amount === 0} />)}</div>
        </Section>

        {report.withOpening && (
          <Section title="Saldo Awal Bulan" value={openingValue} valueClass={opening.kind === 'toko' ? 'text-emerald-600' : opening.kind === 'karyawan' ? 'text-red-500' : ''}
            open={open.sal} onToggle={() => toggle('sal')} testId="sec-saldo">
            {canEditOpening ? (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  {KINDS.map((k) => {
                    const on = openingForm.kind === k.value;
                    return (
                      <button key={k.value} type="button" aria-pressed={on} data-testid={`saldo-${k.value}`}
                        onClick={() => onOpeningChange({ ...openingForm, kind: k.value })}
                        className={`rounded-xl border-2 px-2 py-2 text-xs font-bold leading-tight transition-colors ${on ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                        {k.label}<span className="block font-normal text-slate-400">{k.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1"><NominalInput title="Saldo Awal Bulan" placeholder="0" value={openingForm.amount} onChange={(e) => onOpeningChange({ ...openingForm, amount: e.target.value })} /></div>
                  <Button variant="secondary" onClick={onSaveOpening} disabled={busy}>Simpan</Button>
                </div>
              </div>
            ) : (
              <div className="text-sm"><Row k={opening.kind === 'toko' ? 'Toko berutang' : opening.kind === 'karyawan' ? 'Karyawan berutang' : 'Tidak ada saldo awal'} v={opening.kind ? formatRupiah(opening.amount) : formatRupiah(0)} dim={!opening.kind} /></div>
            )}
          </Section>
        )}

        <Section title="Rincian Harian" value={fmtHM(report.workedMinutes)} open={open.hari} onToggle={() => toggle('hari')} testId="sec-harian">
          {report.days.length === 0 ? <p className="text-xs text-slate-400 py-1">Tidak ada absensi pada periode ini.</p> : (
            <div className="text-xs">
              <div className={`${COLS} px-2 py-1.5 rounded-t-lg bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-400`}>
                <span>Keterangan</span><span className="text-right">Pemasukan (+)</span><span className="text-right">Pengeluaran (-)</span>
              </div>
              {report.days.map((d) => {
                const flags = d.row ? dayFlags(d.date) : { auto: false, edited: false };
                return (
                  <div key={d.date} data-testid="day-row" className="border-t border-slate-100 dark:border-slate-800 pb-1.5">
                    <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                      <b className="text-slate-700 dark:text-slate-200">{fmtDay(d.date)}</b>
                      {d.timeRange && <span className="text-slate-400">{d.timeRange}</span>}
                      {flags.auto && <span className="text-slate-400">otomatis</span>}
                      {flags.edited && <span className="text-sky-600">diedit</span>}
                      {d.row?.effectiveFromBolong && <span className="text-amber-600">bolong dianggap pulang</span>}
                      {d.row && <Badge size="sm" variant={STATUS_VARIANT[d.row.status]}>{STATUS_LABEL[d.row.status]}</Badge>}
                      {d.row && !isLocked && (
                        <button type="button" aria-label={`Edit absen ${fmtDay(d.date)}`} data-testid="edit-day" onClick={() => onEditDay(d.date)} className="ml-auto p-1 text-slate-400 hover:text-accent-600"><Pencil className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    {d.lines.map((l) => (
                      <div key={l.key} data-testid={l.item ? 'adj-row' : undefined} className={`${COLS} px-2 py-0.5 items-center`}>
                        <span className="min-w-0 text-slate-500 dark:text-slate-400">
                          {l.label}
                          {l.item && !isLocked && l.item.kind === 'potongan' && (
                            <button type="button" aria-label="Ubah potongan" data-testid="edit-potongan" onClick={() => onEditDeduction(l.item)} className="ml-1 p-0.5 align-middle text-slate-400 hover:text-accent-600"><Pencil className="w-3 h-3" /></button>
                          )}
                          {l.item && !isLocked && (
                            <button type="button" aria-label="Hapus" onClick={() => onDeleteItem(l.item.kind, l.item)} className="p-0.5 align-middle text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                          )}
                        </span>
                        {money(l.plus, 'text-emerald-600')}
                        {money(l.minus, 'text-red-500')}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {isLocked && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3 mt-2 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0" /> Periode ditutup, jadi tambahan dan potongan tidak bisa diubah.</p>
          )}
        </Section>
      </div>

      <Button variant="secondary" size="full" icon={<Share2 className="w-4 h-4" />} onClick={onShare} data-testid="share-pdf">Bagikan PDF</Button>
    </div>
  );
}
