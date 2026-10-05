import { useState, useMemo } from 'react';
import { Receipt, Trash2, Search, ShoppingBag } from 'lucide-react';
import { Card, Badge, EmptyState, DetailModal, Input, Select, SegmentedControl, Button } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useReportData } from '../../hook/useReportData';
import { summarizeSales, topMenus, periodRange } from './reportsMath';
import ProfitLossTab from './ProfitLossTab';

/**
 * ReportsView — Laporan. Tiga tab:
 *  - Ringkasan: penjualan, HPP menu, laba kotor, per metode bayar/tipe order, menu terlaris.
 *    TIDAK menampilkan "Laba Bersih" (itu di tab Laba Rugi dengan kategori biaya yang benar).
 *  - Riwayat  : daftar transaksi lunas + detail + hapus permanen.
 *  - Laba Rugi: bulanan (lihat ProfitLossTab).
 * Grafik tren dihilangkan (sama seperti di Beranda).
 */
const PAGE = 100;

export default function ReportsView() {
  const { can } = useAuth();
  const [tab, setTab] = useState('ringkasan');
  const canLabaRugi = can('laporan.labaRugi');
  const effectiveTab = tab === 'labarugi' && !canLabaRugi ? 'ringkasan' : tab;
  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="max-w-3xl w-full space-y-4 pb-10">
        <SegmentedControl value={tab} onChange={setTab} options={[{ value: 'ringkasan', label: 'Ringkasan' }, { value: 'riwayat', label: 'Riwayat' }, ...(canLabaRugi ? [{ value: 'labarugi', label: 'Laba Rugi' }] : [])]} />
        {effectiveTab === 'labarugi' ? <ProfitLossTab /> : <SalesTabs tab={effectiveTab} />}
      </div>
    </div>
  );
}

function SalesTabs({ tab }) {
  const { formatRupiah, triggerAlert, triggerConfirm } = useAppContext();
  const { can } = useAuth();
  const canProfit = can('laporan.labaKotor');
  const canDelete = can('laporan.hapusTransaksi');
  const canLabaRugi = can('laporan.labaRugi');
  const [mode, setMode] = useState('hari-ini');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const range = useMemo(() => periodRange(mode, custom), [mode, custom]);
  const { sales, expenses, loading, error, reload, deleteTransaction } = useReportData(range);

  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => summarizeSales(sales), [sales]);
  const menus = useMemo(() => topMenus(sales, 10), [sales]);
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [expenses]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(s => String(s.display_number).toLowerCase().includes(q) || String(s.customer_name || '').toLowerCase().includes(q));
  }, [sales, query]);

  const handleDelete = (s) => {
    triggerConfirm(`Hapus transaksi #${s.display_number} (${formatRupiah(s.total)}) PERMANEN? Angka dompet dan laba rugi ikut berubah.`, async () => {
      if (busy) return;
      setBusy(true);
      try { await deleteTransaction(s.id); setDetail(null); } catch (e) { triggerAlert(e.message); } finally { setBusy(false); }
    });
  };

  return (
    <>
      <Card className="space-y-2">
        <Select value={mode} onChange={e => { setMode(e.target.value); setLimit(PAGE); }}>
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

      {!loading && !error && tab === 'riwayat' && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input value={query} onChange={e => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Cari nomor / pelanggan..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-accent-500/30" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400"><span data-testid="hist-count">{filtered.length}</span> transaksi</p>
          {filtered.length === 0 ? <EmptyState icon={<ShoppingBag className="w-12 h-12" />} title="Tidak ada transaksi pada periode ini" /> : (
            <div className="space-y-2">
              {filtered.slice(0, limit).map(s => (
                <button key={s.id} onClick={() => setDetail(s)} data-testid="hist-row"
                  className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-3.5 flex justify-between items-center gap-3 active:scale-[0.99] transition-all">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100">#{s.display_number} <span className="text-[11px] font-medium text-slate-400">{new Date(s.paid_at || s.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{s.customer_name || 'Umum'} · {(s.items || []).length} item · {s.order_type}</p>
                  </div>
                  <div className="text-right shrink-0"><p className="font-black text-sm text-slate-800 dark:text-slate-100">{formatRupiah(s.total)}</p><Badge size="sm" variant={s.payment_method === 'Ojol' ? 'warning' : 'success'}>{s.payment_method}</Badge></div>
                </button>
              ))}
              {filtered.length > limit && <Button variant="secondary" size="full" onClick={() => setLimit(limit + PAGE)}>Tampilkan lebih banyak ({filtered.length - limit} lagi)</Button>}
            </div>
          )}
        </>
      )}

      <DetailModal
        isOpen={!!detail} onClose={() => setDetail(null)}
        icon={<Receipt className="w-4 h-4 text-accent-500 dark:text-accent-400" />}
        title={detail && `#${detail.display_number}`}
        subtitle={detail && new Date(detail.paid_at || detail.created_at).toLocaleString('id-ID')}
        badges={detail ? [{ label: detail.payment_method === 'Ojol' ? `Ojol (${detail.ojol_platform || ''})` : detail.payment_method, variant: detail.payment_method === 'Ojol' ? 'orange' : 'success' }, { label: detail.order_type, variant: 'neutral' }] : []}
        sections={[{ rows: [{ label: 'Pelanggan', value: detail?.customer_name || 'Umum' }, ...(detail?.ojol_order_number ? [{ label: 'No. Order Ojol', value: detail.ojol_order_number }] : [])] }]}
        items={detail?.items?.map(it => ({ name: it.name, note: [it.variant_name, it.note].filter(Boolean).join(' • '), qty: it.qty, price: it.price }))}
        summaryRows={[
          { label: 'Subtotal', value: detail?.subtotal, type: 'currency' },
          { label: 'Diskon Voucher', value: detail?.voucher_discount ? -detail.voucher_discount : 0, type: 'currency' },
          { label: 'Diskon Manual', value: detail?.manual_discount_amount ? -detail.manual_discount_amount : 0, type: 'currency' },
          { label: 'Ongkir', value: detail?.delivery_fee, type: 'currency' },
        ]}
        highlight={{ label: 'Total Tagihan', value: detail?.total }}
        actions={detail && canDelete ? [{ label: 'Hapus Transaksi', icon: <Trash2 className="w-4 h-4" />, variant: 'danger', onClick: () => handleDelete(detail) }] : []}
      />
    </>
  );
}
