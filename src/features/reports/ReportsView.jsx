import { useState, useMemo } from 'react';
import { Card, Input, Select, SegmentedControl, Button } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useReportData } from '../../hook/useReportData';
import { summarizeSales, topMenus, periodRange } from './reportsMath';
import ProfitLossTab from './ProfitLossTab';

/**
 * ReportsView — Laporan. Dua tab (Riwayat transaksi sekarang layar sendiri: features/history/RiwayatView):
 *  - Ringkasan: penjualan, HPP menu, laba kotor, per metode bayar/tipe order, menu terlaris.
 *    TIDAK menampilkan "Laba Bersih" (itu di tab Laba Rugi dengan kategori biaya yang benar).
 *  - Laba Rugi: bulanan (lihat ProfitLossTab).
 * Grafik tren dihilangkan (sama seperti di Beranda).
 */
export default function ReportsView() {
  const { can } = useAuth();
  const [tab, setTab] = useState('ringkasan');
  const canLabaRugi = can('laporan.labaRugi');
  const effectiveTab = tab === 'labarugi' && !canLabaRugi ? 'ringkasan' : tab;
  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="max-w-3xl w-full space-y-4 pb-10">
        <SegmentedControl value={tab} onChange={setTab} options={[{ value: 'ringkasan', label: 'Ringkasan' }, ...(canLabaRugi ? [{ value: 'labarugi', label: 'Laba Rugi' }] : [])]} />
        {effectiveTab === 'labarugi' ? <ProfitLossTab /> : <SalesTabs tab={effectiveTab} />}
      </div>
    </div>
  );
}

function SalesTabs({ tab }) {
  const { formatRupiah } = useAppContext();
  const { can } = useAuth();
  const canProfit = can('laporan.labaKotor');
  const canLabaRugi = can('laporan.labaRugi');
  const [mode, setMode] = useState('hari-ini');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const range = useMemo(() => periodRange(mode, custom), [mode, custom]);
  const { sales, expenses, loading, error, reload } = useReportData(range);

  const summary = useMemo(() => summarizeSales(sales), [sales]);
  const menus = useMemo(() => topMenus(sales, 10), [sales]);
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [expenses]);
  return (
    <>
      <Card className="space-y-2">
        <Select value={mode} onChange={e => setMode(e.target.value)}>
          <option value="hari-ini">Hari Ini</option><option value="kemarin">Kemarin</option><option value="bulan-ini">Bulan Ini</option>
          <option value="semua">Semua</option><option value="tanggal-terpilih">Tanggal Terpilih</option>
        </Select>
        {mode === 'tanggal-terpilih' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={custom.start} max={custom.end || undefined} onChange={e => setCustom({ ...custom, start: e.target.value })} />
            <span className="text-slate-400">–</span>
            <Input type="date" value={custom.end} min={custom.start || undefined} onChange={e => setCustom({ ...custom, end: e.target.value })} />
          </div>
        )}
      </Card>

      {error && (
        <Card className="text-center space-y-2"><p className="text-sm font-semibold text-red-500">Gagal memuat laporan</p><p className="text-xs text-slate-400">{error}</p><Button onClick={reload}>Coba Lagi</Button></Card>
      )}
      {loading && !error && <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">Memuat laporan...</div>}

      {!loading && !error && tab === 'ringkasan' && (
        <>
          <Card variant="dark" padding="lg" className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Penjualan</p>
            <p className="font-heading text-3xl font-black text-white" data-testid="sum-total">{formatRupiah(summary.total)}</p>
            <p className="text-xs text-slate-400">{summary.count} transaksi · rata-rata {formatRupiah(summary.average)}</p>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {[['HPP (menu)', summary.hppTotal, 'sum-hpp'], ['Laba Kotor', summary.grossProfit, 'sum-kotor'], ['Pengeluaran', totalExpense, 'sum-exp']].filter(([k]) => canProfit || k === 'Pengeluaran').map(([k, v, id]) => (
              <Card key={k} padding="md"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</p><p className="font-heading font-black text-base text-slate-800 dark:text-slate-100" data-testid={id}>{formatRupiah(v)}</p></Card>
            ))}
          </div>
          {canProfit && summary.itemsWithoutHppQty > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">{summary.itemsWithoutHppQty} porsi terjual belum punya HPP di menu, jadi Laba Kotor bisa terlalu besar.</p>
          )}
          {canLabaRugi && <p className="text-[11px] text-slate-400 dark:text-slate-500">Laba bersih (setelah biaya operasional dan gaji) ada di tab Laba Rugi.</p>}

          {[['Per Metode Bayar', summary.byPayment], ['Per Tipe Pesanan', summary.byOrderType]].map(([title, rows]) => (
            <Card key={title} className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{title}</p>
              {rows.length === 0 ? <p className="text-xs text-slate-400">Belum ada data.</p> : rows.map(r => (
                <div key={r.key} className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{r.key} <span className="text-slate-400 text-xs">({r.count})</span></span><span className="font-bold text-slate-800 dark:text-slate-100">{formatRupiah(r.total)}</span></div>
              ))}
            </Card>
          ))}

          <Card className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Menu Terlaris</p>
            {menus.length === 0 ? <p className="text-xs text-slate-400">Belum ada data.</p> : menus.map((m, i) => (
              <div key={m.key} className="flex justify-between text-sm gap-3"><span className="text-slate-600 dark:text-slate-300 min-w-0 truncate"><span className="text-slate-400 mr-1.5">{i + 1}.</span>{m.name}</span><span className="shrink-0"><span className="font-bold text-slate-800 dark:text-slate-100">{m.qty}×</span> <span className="text-xs text-slate-400">{formatRupiah(m.revenue)}</span></span></div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
