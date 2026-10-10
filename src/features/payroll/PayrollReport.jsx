import { useState } from 'react';
import { ChevronRight, Pencil, Trash2, Share2, Lock } from 'lucide-react';
import { Badge, Button, NominalInput } from '../../components/ui';
import { fmtDay, fmtHM, STATUS_LABEL, STATUS_VARIANT, dayDetail, itemTitle } from './payrollReport';

/**
 * PayrollReport — isi detail gaji satu karyawan, untuk periode MINGGUAN dan BULANAN (tampilan sama).
 * Ringkas dulu, rinciannya dibuka sendiri-sendiri (tanpa tab): Total Pendapatan, Pengurangan, Rincian Harian.
 *  - Pengurangan memuat Kasbon, Potongan, dan (khusus bulanan) Saldo awal + form Saldo Awal Bulan.
 *  - Rincian Harian memuat absensi per tanggal; Tambahan/Potongan/Kasbon tampil di tanggalnya.
 *    Potongan bisa diubah (membuka form Potongan Catat Cepat) atau dihapus; Tambahan hanya dihapus.
 * Data berasal dari buildPayrollReport (payrollReport.js).
 */

function Section({ title, sub, value, valueClass = '', open, onToggle, testId, children }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <button type="button" onClick={onToggle} aria-expanded={open} data-testid={testId}
        className="w-full flex items-center gap-2 py-3.5 text-left active:opacity-70">
        <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        <span className="font-bold text-slate-800 dark:text-slate-100 shrink-0">{title}</span>
        {sub && <span className="text-xs text-slate-400 truncate">{sub}</span>}
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
  canEditOpening, openingInput, onOpeningChange, onSaveOpening, busy, onShare,
}) {
  const [open, setOpen] = useState({ pend: false, cut: false, hari: false });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-baseline gap-3" data-testid="gaji-bersih">
        <span className="font-bold text-base text-slate-800 dark:text-slate-100">Gaji Bersih</span>
        <span className={`font-heading font-bold text-xl ${report.net < 0 ? 'text-red-500' : 'text-accent-600 dark:text-accent-400'}`}>{formatRupiah(report.net)}</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <Badge size="sm" variant="neutral">{report.hadirDays} hari hadir</Badge>
        {report.liburDays > 0 && <Badge size="sm" variant="neutral">{report.liburDays} libur</Badge>}
        <Badge size="sm" variant="info">{fmtHM(report.workedMinutes)}</Badge>
      </div>

      {notice}

      <div>
        <Section title="Total Pendapatan" value={formatRupiah(report.totalIncome)} open={open.pend} onToggle={() => toggle('pend')} testId="sec-pendapatan">
          <div className="text-sm">{report.income.map((r) => <Row key={r.key} k={r.label} v={formatRupiah(r.amount)} dim={r.amount === 0} />)}</div>
        </Section>

        <Section title="Pengurangan" value={formatRupiah(-report.totalDeductions)} valueClass={report.totalDeductions > 0 ? 'text-red-500' : ''}
          open={open.cut} onToggle={() => toggle('cut')} testId="sec-pengurangan">
          <div className="text-sm">{report.cuts.map((r) => <Row key={r.key} k={r.label} v={formatRupiah(-r.amount)} dim={r.amount === 0} />)}</div>
          {canEditOpening && (
            <div className="space-y-2 pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo Awal Bulan</p>
              <div className="flex gap-2">
                <div className="flex-1"><NominalInput title="Saldo Awal Bulan" allowNegative placeholder="0" value={openingInput} onChange={(e) => onOpeningChange(e.target.value)} /></div>
                <Button variant="secondary" onClick={onSaveOpening} disabled={busy}>Simpan</Button>
              </div>
            </div>
          )}
        </Section>

        <Section title="Rincian Harian" sub={`${report.hadirDays} hadir · ${report.liburDays} libur`} value={fmtHM(report.workedMinutes)}
          open={open.hari} onToggle={() => toggle('hari')} testId="sec-harian">
          {report.days.length === 0 ? <p className="text-xs text-slate-400 py-1">Tidak ada absensi pada periode ini.</p> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {report.days.map((d) => {
                const flags = d.row ? dayFlags(d.date) : { auto: false, edited: false };
                return (
                  <div key={d.date} data-testid="day-row">
                    <div className="py-2 flex justify-between items-center gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{fmtDay(d.date)}</span>{' '}
                        {d.row && <Badge size="sm" variant={STATUS_VARIANT[d.row.status]}>{STATUS_LABEL[d.row.status]}</Badge>}
                        {d.row?.effectiveFromBolong && <span className="text-xs text-amber-600 ml-1">bolong dianggap pulang</span>}
                        {flags.auto && <span className="text-xs text-slate-400 ml-1">otomatis</span>}
                        {flags.edited && <span className="text-xs text-sky-600 ml-1">diedit</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {d.row?.status === 'hadir' && <span className="text-slate-500 dark:text-slate-400">{dayDetail(d.row)}</span>}
                        {d.row && !isLocked && (
                          <button type="button" aria-label={`Edit absen ${fmtDay(d.date)}`} data-testid="edit-day" onClick={() => onEditDay(d.date)} className="p-1 text-slate-400 hover:text-accent-600"><Pencil className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </div>
                    {d.items.map((it) => {
                      const plus = it.kind === 'tambahan';
                      return (
                        <div key={it.kind + it.id} data-testid="adj-row" className="flex justify-between items-center gap-2 pl-3 pb-2 text-xs">
                          <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">{itemTitle(it)}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`font-bold ${plus ? 'text-emerald-600' : 'text-red-500'}`}>{plus ? '+' : '-'}{formatRupiah(it.amount)}</span>
                            {!isLocked && !plus && (
                              <button type="button" aria-label="Ubah potongan" data-testid="edit-potongan" onClick={() => onEditDeduction(it)} className="p-1 text-slate-400 hover:text-accent-600"><Pencil className="w-3.5 h-3.5" /></button>
                            )}
                            {!isLocked && (
                              <button type="button" aria-label="Hapus" onClick={() => onDeleteItem(it.kind, it)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
