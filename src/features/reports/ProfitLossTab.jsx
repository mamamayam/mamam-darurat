import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { Card, Button, SegmentedControl } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useReportData } from '../../hook/useReportData';
import { usePayrollData } from '../../hook/usePayrollData';
import { monthPeriod, formatIsoDate } from '../payroll/payrollEngine';
import { computeProfitLoss, payrollCostFromResults, payrollCostByEmployee, localDateString } from './reportsMath';

const MON_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const shiftMonth = (key, delta) => formatIsoDate(new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + delta, 1))).slice(0, 7);

/**
 * ProfitLossTab — Laba Rugi bulanan. Rumus: lihat reportsMath.js (aturan dari
 * modul Balance mamam-global). Gaji dihitung payrollEngine dari absensi; kalau
 * absensi belum tersambung, Laba Bersih DITANDAI belum termasuk gaji (bukan diam-diam
 * menganggap gaji = 0).
 */
export default function ProfitLossTab() {
  const { formatRupiah } = useAppContext();
  const todayMonth = localDateString().slice(0, 7);
  const [month, setMonth] = useState(todayMonth);
  const [hppBasis, setHppBasis] = useState('belanja');

  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const range = useMemo(() => ({ fromDate: `${month}-01`, toDate: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }), [month, y, m]);
  const report = useReportData(range);
  const period = useMemo(() => monthPeriod(month), [month]);
  const payroll = usePayrollData({ period });

  const payrollReady = payroll.status === 'ready' || payroll.status === 'closed';
  const waiting = report.loading || payroll.loading || payroll.status === 'loading';
  const cost = payrollReady ? payrollCostFromResults(payroll.results) : null;
  const pl = useMemo(() => computeProfitLoss({ sales: report.sales, expenses: report.expenses, payrollCost: cost ? cost.total : null, hppBasis }),
    [report.sales, report.expenses, cost && cost.total, hppBasis]); // eslint-disable-line react-hooks/exhaustive-deps
  const gajiRows = payrollReady ? payrollCostByEmployee(payroll.results) : [];

  const warnings = [];
  if (!pl.gajiIncluded) {
    warnings.push(payroll.status === 'error'
      ? `Absensi gagal dibaca (${payroll.attendance.error}), jadi Biaya Gaji belum dihitung. Laba Bersih ini BELUM dikurangi gaji.`
      : 'Absensi belum tersambung (lihat menu Penggajian), jadi Biaya Gaji belum dihitung. Laba Bersih ini BELUM dikurangi gaji.');
  }
  if (hppBasis === 'menu' && pl.itemsWithoutHppQty > 0) warnings.push(`${pl.itemsWithoutHppQty} porsi terjual belum punya HPP di menu, jadi Laba Kotor bisa terlalu besar. Isi HPP-nya di Manajemen Menu.`);
  if (pl.gajiExpenseIgnored > 0) warnings.push(`Pengeluaran kategori "Gaji" (${formatRupiah(pl.gajiExpenseIgnored)}) tidak dihitung lagi sebagai biaya, karena Biaya Gaji diambil dari Penggajian. Kalau itu bukan pembayaran gaji, ganti kategorinya.`);
  if (cost && cost.kasbonTotal > 0) warnings.push(`Kasbon ${formatRupiah(cost.kasbonTotal)} tidak dihitung sebagai biaya (itu piutang ke karyawan).`);

  const Line = ({ k, v, sign, bold, indent, testid }) => (
    <div className={`flex justify-between gap-3 py-1.5 ${bold ? 'font-black text-slate-900 dark:text-slate-50 border-t border-slate-200 dark:border-slate-700 mt-1 pt-2.5' : 'text-slate-600 dark:text-slate-300'} ${indent ? 'pl-4 text-xs' : 'text-sm'}`}>
      <span className="min-w-0">{k}</span>
      <span className="font-bold shrink-0 text-slate-800 dark:text-slate-100" data-testid={testid}>{sign === '-' && v !== 0 ? '−' : ''}{formatRupiah(v)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Bulan sebelumnya" className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center">
            <p className="font-heading font-black text-slate-800 dark:text-slate-100 text-sm" data-testid="pl-month">{MON_FULL[m - 1]} {y}</p>
            <button onClick={() => setMonth(todayMonth)} className="text-[11px] font-bold text-accent-600 dark:text-accent-400">Ke bulan ini</button>
          </div>
          <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Bulan berikutnya" className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Dasar HPP</p>
          <SegmentedControl value={hppBasis} onChange={setHppBasis} options={[{ value: 'belanja', label: 'Belanja Bahan Baku' }, { value: 'menu', label: 'HPP Menu' }]} />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">{hppBasis === 'belanja' ? 'Seperti Balance di mamam-global, tanpa stok opname: HPP = total pengeluaran kategori Belanja bulan ini.' : 'HPP = jumlah (HPP menu × porsi terjual). Belanja bahan baku tidak dikurangkan lagi.'}</p>
        </div>
      </Card>

      {report.error && (
        <Card className="text-center space-y-2"><p className="text-sm font-semibold text-red-500">Gagal memuat laporan</p><p className="text-xs text-slate-400">{report.error}</p><Button onClick={report.reload} icon={<RefreshCw className="w-4 h-4" />}>Coba Lagi</Button></Card>
      )}
      {waiting && !report.error && <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">Menghitung laba rugi...</div>}

      {!waiting && !report.error && (
        <>
          <Card variant="dark" padding="lg" className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{pl.gajiIncluded ? 'Laba Bersih' : 'Laba Sebelum Gaji'}</p>
            <p className={`font-heading text-3xl font-black ${pl.labaBersih < 0 ? 'text-red-400' : 'text-emerald-400'}`} data-testid="pl-net">{formatRupiah(pl.labaBersih)}</p>
            {!pl.gajiIncluded && <p className="text-[11px] text-amber-300">Belum dikurangi gaji karyawan.</p>}
          </Card>

          {warnings.length > 0 && (
            <Card className="space-y-2 border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
              {warnings.map((w, i) => <p key={i} className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>)}
            </Card>
          )}

          <Card>
            <Line k="Penghasilan (penjualan lunas)" v={pl.penghasilan} testid="pl-penghasilan" />
            <Line k={`HPP (${hppBasis === 'belanja' ? 'belanja bahan baku' : 'menurut menu'})`} v={pl.hpp} sign="-" testid="pl-hpp" />
            <Line k="Laba Kotor" v={pl.labaKotor} bold testid="pl-kotor" />
            <Line k="Biaya Operasional" v={pl.biayaOperasional} sign="-" testid="pl-ops" />
            {pl.operasionalByCategory.map(c => <Line key={c.category} k={c.category} v={c.total} indent />)}
            <Line k={pl.gajiIncluded ? `Biaya Gaji (upah kotor${payroll.isLocked ? ', beku' : ''})` : 'Biaya Gaji (belum dihitung)'} v={pl.biayaGaji} sign="-" testid="pl-gaji" />
            {gajiRows.map(g => <Line key={g.id} k={g.name} v={g.gross} indent />)}
            <Line k={pl.gajiIncluded ? 'Laba Bersih' : 'Laba Sebelum Gaji'} v={pl.labaBersih} bold testid="pl-net-row" />
          </Card>

          <Card className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Pembanding HPP</p>
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300"><span>Belanja bahan baku bulan ini</span><span className="font-bold">{formatRupiah(pl.belanjaBahanBaku)}</span></div>
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300"><span>HPP menurut menu</span><span className="font-bold">{formatRupiah(pl.hppMenu)}</span></div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Selisih besar biasanya karena belanja stok yang belum terpakai, atau HPP menu yang belum diisi. Pemasukan non-penjualan tidak dihitung, sama seperti di mamam-global.</p>
          </Card>
        </>
      )}
    </div>
  );
}
