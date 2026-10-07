import { useMemo } from 'react';
import { Card, Badge } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useReportData } from '../../hook/useReportData';
import { summarizeExpenses, expenseDetailText } from './reportsMath';
import ReportGate from './ReportGate';

// transaction_date sudah 'YYYY-MM-DD' (lihat useReportData); jangan di-parse sebagai UTC.
const showDate = (v) => {
  const [y, m, d] = String(v).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID');
};

/**
 * RincianPengeluaranTab — rincian SEMUA pengeluaran pada periode (belanja, bayar
 * ayam, kasbon, gaji, dll, tunai maupun non-tunai): total, per kategori, dan
 * daftar per catatan. Penjualan tidak dimuat. Hanya baca; edit/hapus ada di
 * layar Pengeluaran.
 */
export default function RincianPengeluaranTab({ range }) {
  const { formatRupiah } = useAppContext();
  const { expenses, loading, error, reload } = useReportData({ ...range, withSales: false });
  const summary = useMemo(() => summarizeExpenses(expenses), [expenses]);

  return (
    <ReportGate loading={loading} error={error} reload={reload}>
      <Card variant="dark" padding="lg" className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Pengeluaran</p>
        <p className="font-heading text-3xl font-bold text-white" data-testid="exp-total">{formatRupiah(summary.total)}</p>
        <p className="text-xs text-slate-400">{summary.count} catatan</p>
      </Card>

      <Card className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Per Kategori</p>
        {summary.byCategory.length === 0 ? <p className="text-xs text-slate-400">Belum ada data.</p> : summary.byCategory.map(c => (
          <div key={c.category} className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{c.category} <span className="text-slate-400 text-xs">({c.count})</span></span><span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(c.total)}</span></div>
        ))}
      </Card>

      <Card className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Daftar Pengeluaran</p>
        {expenses.length === 0 ? <p className="text-xs text-slate-400">Belum ada data.</p> : expenses.map(e => {
          const detail = expenseDetailText(e);
          return (
            <div key={e.id} className="flex justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                  {e.category}
                  <Badge variant="neutral">{showDate(e.transaction_date)}</Badge>
                  {e.payment_method === 'Non-Tunai' && <Badge variant="info">Bank</Badge>}
                </p>
                {detail && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">{detail}</p>}
              </div>
              <span className="font-bold shrink-0 text-red-600 dark:text-red-400">-{formatRupiah(e.amount)}</span>
            </div>
          );
        })}
      </Card>
    </ReportGate>
  );
}
