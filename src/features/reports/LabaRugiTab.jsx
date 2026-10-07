import { useMemo } from 'react';
import { Card } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useReportData } from '../../hook/useReportData';
import { summarizeSales, summarizeExpenses, topMenus } from './reportsMath';
import ReportGate from './ReportGate';

/**
 * LabaRugiTab — Laba Rugi: Total Penjualan, Laba Kotor, Pengeluaran.
 *   Laba Kotor = Total Penjualan − Pengeluaran (SEMUA pengeluaran, lihat reportsMath).
 * Di bawahnya: penjualan per metode bayar / tipe pesanan dan menu terlaris.
 * Kartu Laba Kotor hanya untuk yang berizin `laporan.labaKotor`.
 */
export default function LabaRugiTab({ range }) {
  const { formatRupiah } = useAppContext();
  const { can } = useAuth();
  const canProfit = can('laporan.labaKotor');
  const { sales, expenses, loading, error, reload } = useReportData(range);

  const summary = useMemo(() => summarizeSales(sales), [sales]);
  const menus = useMemo(() => topMenus(sales, 10), [sales]);
  const pengeluaran = useMemo(() => summarizeExpenses(expenses).total, [expenses]);
  const labaKotor = summary.total - pengeluaran;

  return (
    <ReportGate loading={loading} error={error} reload={reload}>
      <Card variant="dark" padding="lg" className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Penjualan</p>
        <p className="font-heading text-3xl font-bold text-white" data-testid="sum-total">{formatRupiah(summary.total)}</p>
        <p className="text-xs text-slate-400">{summary.count} transaksi · rata-rata {formatRupiah(summary.average)}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {[['Laba Kotor', labaKotor, 'sum-kotor'], ['Pengeluaran', pengeluaran, 'sum-exp']].filter(([k]) => canProfit || k === 'Pengeluaran').map(([k, v, id]) => (
          <Card key={k} padding="md"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{k}</p><p className="font-heading font-bold text-base text-slate-800 dark:text-slate-100" data-testid={id}>{formatRupiah(v)}</p></Card>
        ))}
      </div>

      {[['Per Metode Bayar', summary.byPayment], ['Per Tipe Pesanan', summary.byOrderType]].map(([title, rows]) => (
        <Card key={title} className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{title}</p>
          {rows.length === 0 ? <p className="text-xs text-slate-400">Belum ada data.</p> : rows.map(r => (
            <div key={r.key} className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{r.key} <span className="text-slate-400 text-xs">({r.count})</span></span><span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(r.total)}</span></div>
          ))}
        </Card>
      ))}

      <Card className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Menu Terlaris</p>
        {menus.length === 0 ? <p className="text-xs text-slate-400">Belum ada data.</p> : menus.map((m, i) => (
          <div key={m.key} className="flex justify-between text-sm gap-3"><span className="text-slate-600 dark:text-slate-300 min-w-0 truncate"><span className="text-slate-400 mr-1.5">{i + 1}.</span>{m.name}</span><span className="shrink-0"><span className="font-bold text-slate-800 dark:text-slate-100">{m.qty}×</span> <span className="text-xs text-slate-400">{formatRupiah(m.revenue)}</span></span></div>
        ))}
      </Card>
    </ReportGate>
  );
}
