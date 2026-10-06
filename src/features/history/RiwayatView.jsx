import { useState, useMemo } from 'react';
import { Filter, ArrowUpDown, Search, X, CreditCard, RefreshCw, Eye, Trash2, Receipt, ShoppingBag } from 'lucide-react';
import { Card, EmptyState, DetailModal, Button, Input, Select, BulkSelectBar } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useReportData } from '../../hook/useReportData';
import { useBulkSelect } from '../../hook/useBulkSelect';
import { periodRange } from '../reports/reportsMath';

/**
 * RiwayatView — Riwayat transaksi lunas, layar tersendiri (dulu tab di Laporan).
 * Tampilan mengikuti Riwayat di mamam-global: chip periode, filter tipe order +
 * urutan + cari, kartu "Omset per Metode Pembayaran" (ketuk untuk menyaring),
 * lalu kartu per order dengan Detail / Hapus.
 *
 * BEDA dari A (sengaja):
 *  - Tombol "Struk" belum ada: ReceiptModal belum di-port ke C.
 *  - Hapus = permanen dan hanya Owner (izin laporan.hapusTransaksi).
 *  - Online-first: data dibaca langsung dari Supabase; "Perbarui" = muat ulang.
 */
const PAGE = 100;
const PERIODS = [
  { key: 'hari-ini', label: 'Hari Ini' },
  { key: 'kemarin', label: 'Kemarin' },
  { key: 'bulan-ini', label: 'Bulan Ini' },
  { key: 'semua', label: 'Semua' },
  { key: 'tanggal-terpilih', label: 'Tanggal Terpilih' },
];
const SORTS = [
  { key: 'terbaru', label: 'Terbaru Dulu' },
  { key: 'terlama', label: 'Terlama Dulu' },
  { key: 'total-desc', label: 'Total Terbesar' },
  { key: 'total-asc', label: 'Total Terkecil' },
];
const NO_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const saleTime = (s) => new Date(s.paid_at || s.created_at).getTime();
const methodOf = (s) => s.payment_method || 'Lainnya';

/** Tombol bulat berisi ikon; ketuk = buka daftar pilihan bawaan HP (select transparan di atas ikon). */
function IconSelect({ icon: Icon, value, active, onChange, children, label }) {
  return (
    <div className={`relative shrink-0 w-11 h-11 rounded-full border transition-all duration-300 ${active ? 'border-accent-500 bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
      <Icon className="w-5 h-5 absolute inset-0 m-auto pointer-events-none" />
      <select
        aria-label={label} title={label} value={value} onChange={onChange}
        className="absolute inset-0 w-full h-full appearance-none opacity-0 cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}

export default function RiwayatView() {
  const { formatRupiah, triggerAlert, triggerConfirm } = useAppContext();
  const { can } = useAuth();
  const canDelete = can('laporan.hapusTransaksi');

  const [mode, setMode] = useState('hari-ini');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [typeFilter, setTypeFilter] = useState('semua');
  const [sortKey, setSortKey] = useState('terbaru');
  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('semua');
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => periodRange(mode, custom), [mode, custom]);
  const { sales, loading, error, updatedAt, reload, deleteTransaction, bulkDeleteTransactions } =
    useReportData({ ...range, withExpenses: false });

  const resetPaging = () => setLimit(PAGE);

  const orderTypes = useMemo(() => [...new Set(sales.map(s => s.order_type).filter(Boolean))].sort(), [sales]);

  // Daftar setelah tipe order + pencarian (BELUM metode bayar) — dasar kartu omset.
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter(s => {
      if (typeFilter !== 'semua' && s.order_type !== typeFilter) return false;
      if (!q) return true;
      return String(s.display_number).toLowerCase().includes(q)
        || String(s.id).toLowerCase().includes(q)
        || String(s.customer_name || '').toLowerCase().includes(q);
    });
  }, [sales, typeFilter, query]);

  const methodStats = useMemo(() => {
    const map = new Map();
    base.forEach(s => {
      const k = methodOf(s);
      const cur = map.get(k) || { key: k, count: 0, total: 0 };
      cur.count += 1; cur.total += Number(s.total) || 0;
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [base]);
  const grandTotal = useMemo(() => base.reduce((sum, s) => sum + (Number(s.total) || 0), 0), [base]);

  // Metode yang dipilih bisa hilang setelah filter lain berubah -> anggap Semua.
  const activeMethod = methodStats.some(m => m.key === methodFilter) ? methodFilter : 'semua';

  const visible = useMemo(() => {
    const list = activeMethod === 'semua' ? base : base.filter(s => methodOf(s) === activeMethod);
    const t = (s) => Number(s.total) || 0;
    const sorters = {
      terbaru: (a, b) => saleTime(b) - saleTime(a),
      terlama: (a, b) => saleTime(a) - saleTime(b),
      'total-desc': (a, b) => t(b) - t(a),
      'total-asc': (a, b) => t(a) - t(b),
    };
    return [...list].sort(sorters[sortKey] || sorters.terbaru);
  }, [base, activeMethod, sortKey]);

  const { selectedIds, allSelected, toggleOne, toggleAll, reset, count } = useBulkSelect(visible);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { triggerAlert(e.message || 'Terjadi kesalahan.'); } finally { setBusy(false); }
  };

  const handleDelete = (s) => {
    triggerConfirm(`Hapus transaksi #${s.display_number} (${formatRupiah(s.total)}) PERMANEN? Angka dompet dan laba rugi ikut berubah.`, () =>
      run(async () => { await deleteTransaction(s.id); setDetail(null); }));
  };

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    triggerConfirm(`Hapus ${ids.length} transaksi terpilih PERMANEN? Angka dompet dan laba rugi ikut berubah.`, () =>
      run(async () => { await bulkDeleteTransactions(ids); reset(); setIsSelecting(false); }));
  };

  const toggleSelecting = () => { if (isSelecting) reset(); setIsSelecting(v => !v); };
  const updatedLabel = updatedAt ? updatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Memuat...';

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="max-w-3xl w-full space-y-4 pb-10">

        {/* Periode + tipe order / urutan (ikon) + cari */}
        <Card className="space-y-3">
          <Select aria-label="Periode" data-testid="period-select" value={mode} onChange={e => { setMode(e.target.value); setMethodFilter('semua'); resetPaging(); }}>
            {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </Select>
          {mode === 'tanggal-terpilih' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={custom.start} max={custom.end || undefined} onChange={e => { setCustom({ ...custom, start: e.target.value }); resetPaging(); }} />
              <span className="text-slate-400">–</span>
              <Input type="date" value={custom.end} min={custom.start || undefined} onChange={e => { setCustom({ ...custom, end: e.target.value }); resetPaging(); }} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query} onChange={e => { setQuery(e.target.value); resetPaging(); }} placeholder="Cari order, ID, nama..."
                className="w-full h-11 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-10 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all duration-300"
              />
              {query && (
                <button onClick={() => { setQuery(''); resetPaging(); }} aria-label="Hapus pencarian" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-90 transition-all">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <IconSelect icon={Filter} label="Tipe order" active={typeFilter !== 'semua'} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); resetPaging(); }}>
              <option value="semua">Semua Tipe Order</option>
              {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </IconSelect>
            <IconSelect icon={ArrowUpDown} label="Urutkan" active={sortKey !== 'terbaru'} value={sortKey} onChange={e => setSortKey(e.target.value)}>
              {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </IconSelect>
          </div>
        </Card>

        {error && (
          <Card className="text-center space-y-2">
            <p className="text-sm font-semibold text-red-500">Gagal memuat riwayat</p>
            <p className="text-xs text-slate-400">{error}</p>
            <Button onClick={reload}>Coba Lagi</Button>
          </Card>
        )}

        {/* Omset per metode bayar — grid ringkas, muat satu kartu tanpa geser samping */}
        {!error && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 min-w-0">
                <CreditCard className="w-4 h-4 text-slate-400 shrink-0" /> <span className="truncate">Omset per Metode Pembayaran</span>
              </h3>
              <div className="flex items-center gap-0.5 shrink-0 text-xs text-slate-400 dark:text-slate-500" title="Terakhir diperbarui">
                <span data-testid="riwayat-updated">{updatedLabel}</span>
                <button onClick={reload} aria-label="Perbarui" disabled={loading} className="p-1.5 rounded-full text-accent-600 dark:text-accent-400 active:scale-90 transition-all disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ key: 'semua', label: 'SEMUA', total: grandTotal, wide: true }, ...methodStats.map(m => ({ key: m.key, label: `${m.key.toUpperCase()} · ${m.count}X`, total: m.total }))].map(c => (
                <button
                  key={c.key} onClick={() => { setMethodFilter(c.key); resetPaging(); }} data-testid={`method-${c.key}`}
                  className={`${c.wide ? 'col-span-2' : ''} min-w-0 text-left rounded-xl px-3 py-2 border transition-all duration-300 active:scale-95 ${activeMethod === c.key ? 'bg-slate-800 dark:bg-white border-slate-800 dark:border-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}
                >
                  <p className="text-xs font-bold tracking-wide opacity-80 truncate">{c.label}</p>
                  <p className="font-heading font-bold text-sm mt-0.5 truncate">{formatRupiah(c.total)}</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {loading && !error && <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">Memuat riwayat...</div>}

        {!loading && !error && (
          <>
            {isSelecting && visible.length > 0 && (
              <BulkSelectBar count={count} total={visible.length} allSelected={allSelected} onToggleAll={toggleAll} onDeleteSelected={handleBulkDelete} />
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400"><span data-testid="hist-count">{visible.length}</span> transaksi</p>
              {canDelete && visible.length > 0 && (
                <button
                  onClick={toggleSelecting} data-testid="riwayat-pilih"
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-300 active:scale-95 shrink-0 ${isSelecting ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400'}`}
                >
                  {isSelecting ? 'Batal' : 'Pilih Banyak'}
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <EmptyState icon={<ShoppingBag className="w-12 h-12" />} title="Tidak ada transaksi pada periode ini" />
            ) : (
              <div className="space-y-4">
                {visible.slice(0, limit).map(s => (
                  <div key={s.id} data-testid="hist-row"
                    className={`bg-white dark:bg-slate-900 rounded-3xl border p-5 shadow-sm ${selectedIds.has(s.id) ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex justify-between items-start gap-3 pb-3 border-b border-dashed border-slate-200 dark:border-slate-700">
                      <div className="flex items-start gap-3 min-w-0">
                        {isSelecting && (
                          <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleOne(s.id)} className="w-5 h-5 mt-0.5 rounded accent-[#ea580c] cursor-pointer shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-heading font-bold text-lg text-slate-800 dark:text-slate-100 truncate">#{s.display_number}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(s.paid_at || s.created_at).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border ${s.payment_method === 'Ojol' ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 border-accent-100 dark:border-accent-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'}`}>
                        {methodOf(s)}{s.payment_method === 'Ojol' && s.ojol_platform ? ` (${s.ojol_platform})` : ''}
                      </span>
                    </div>

                    <div className="py-4 space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-100">Pelanggan: {s.customer_name || 'Umum'}</p>
                      <p className="text-slate-500 dark:text-slate-400">{(s.items || []).length} Item • {s.order_type}</p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-heading font-bold text-2xl text-slate-800 dark:text-slate-100 min-w-0 truncate">{formatRupiah(s.total)}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setDetail(s)} title="Detail" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all">
                          <Eye className="w-4 h-4" /> Detail
                        </button>
                        {canDelete && (
                          <button onClick={() => handleDelete(s)} title="Hapus" disabled={busy} className="p-2.5 rounded-2xl bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-500/20 active:scale-95 transition-all disabled:opacity-50">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {visible.length > limit && <Button variant="secondary" size="full" onClick={() => setLimit(limit + PAGE)}>Tampilkan lebih banyak ({visible.length - limit} lagi)</Button>}
              </div>
            )}
          </>
        )}
      </div>

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
    </div>
  );
}
