import { useState, useMemo } from 'react';
import { Plus, Minus, ShoppingBag, Users, Check, X, Clock, Wallet } from 'lucide-react';
import { Badge, Button, Input, EmptyState, PillTabs } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useQuickEntries } from '../../hook/useQuickEntries';
import { useExpenseData } from '../../hook/useExpenseData';
import ExpenseFormSheet from '../expense/ExpenseFormSheet';
import QuickAdjustmentSheet from './QuickAdjustmentSheet';
import { filterFeed } from './quickEntryMath';

/**
 * QuickEntrySection — "Catat Cepat" di Beranda (menggantikan daftar Riwayat Pesanan Hari Ini).
 *
 *  Operasional toko : Pengeluaran  -> form Pengeluaran yang sama dengan menu Pengeluaran
 *  Karyawan         : Tambah, Potongan -> isian yang sama dengan form di Penggajian
 *
 * Hanya Tambah dari staf yang butuh persetujuan owner. Potongan & pengeluaran langsung dicatat
 * (potongan otomatis jadi pengeluaran karyawan; tunai mengurangi saldo Dompet).
 * Nominal Tambah/Potongan disamarkan untuk yang tidak boleh melihat upah (izin 'karyawan.upah').
 */

const GROUP = 'text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2';
const CARD = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800';
const MASK = 'Rp •••••';

const KIND_ICON = {
  tambah: { Icon: Plus, cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', amt: 'text-emerald-600 dark:text-emerald-400', sign: '+' },
  potongan: { Icon: Minus, cls: 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400', amt: 'text-red-600 dark:text-red-400', sign: '-' },
  pengeluaran: { Icon: ShoppingBag, cls: 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400', amt: 'text-accent-600 dark:text-accent-400', sign: '-' },
};
const STATUS_BADGE = { menunggu: ['warning', 'Menunggu'], disetujui: ['success', 'Disetujui'], ditolak: ['danger', 'Ditolak'] };

const TABS = [{ value: 'semua', label: 'Semua' }, { value: 'karyawan', label: 'Karyawan' }, { value: 'toko', label: 'Toko' }];

export default function QuickEntrySection({ onChanged }) {
  const { can } = useAuth();
  const { formatRupiah, triggerAlert, triggerConfirm } = useAppContext();
  const canApprove = can('tambahan.setujui');
  const canWage = can('karyawan.upah');            // boleh melihat nominal catatan karyawan

  const quick = useQuickEntries({ canApprove, onChanged });
  const expenseData = useExpenseData({ withExpenses: false });

  const [sheet, setSheet] = useState(null);        // null | 'pengeluaran' | 'tambahan' | 'potongan'
  const [tab, setTab] = useState('semua');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { triggerAlert(e.message || 'Terjadi kesalahan.'); }
    finally { setBusy(false); }
  };

  const feed = useMemo(() => filterFeed(quick.feed, tab), [quick.feed, tab]);
  const money = (n, masked) => (masked ? MASK : formatRupiah(n));

  const approve = (r) => run(() => quick.decide(r.id, true));
  const reject = (r) => run(async () => { await quick.decide(r.id, false, rejectReason); setRejectingId(null); setRejectReason(''); });
  const cancel = (item) => triggerConfirm(`Batalkan pengajuan ${item.tag} untuk ${item.title}?`, () => run(() => quick.cancelRequest(item.id)));

  return (
    <section className="mb-4" aria-label="Catat Cepat" data-testid="catat-cepat">
      <h3 className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">Catat Cepat</h3>

      {/* Standar tombol (lihat Button.jsx): Pengeluaran = aksi utama (primary), Tambah/Potongan = pendukung (secondary). */}
      <p className={GROUP}>Operasional toko</p>
      <Button size="full" className="mb-4" icon={<ShoppingBag className="w-4 h-4" />} onClick={() => setSheet('pengeluaran')} data-testid="tile-pengeluaran">
        Pengeluaran
      </Button>

      <p className={GROUP}>Karyawan</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Button variant="secondary" size="full" icon={<Plus className="w-4 h-4" />} onClick={() => setSheet('tambahan')} data-testid="tile-tambah">
          Tambah
        </Button>
        <Button variant="secondary" size="full" icon={<Minus className="w-4 h-4" />} onClick={() => setSheet('potongan')} data-testid="tile-potongan">
          Potongan
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`${CARD} p-4`} data-testid="kartu-pengeluaran-karyawan">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-500 dark:text-purple-400 flex items-center justify-center shrink-0"><Users className="w-4 h-4" /></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight">Pengeluaran Karyawan</p>
          </div>
          <p className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100">{quick.loading ? '...' : money(quick.totals.karyawan, !canWage)}</p>
        </div>
        <div className={`${CARD} p-4`} data-testid="kartu-pengeluaran-toko">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-accent-50 dark:bg-accent-500/10 text-accent-500 dark:text-accent-400 flex items-center justify-center shrink-0"><ShoppingBag className="w-4 h-4" /></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight">Pengeluaran Toko</p>
          </div>
          <p className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100">{quick.loading ? '...' : formatRupiah(quick.totals.toko)}</p>
        </div>
      </div>

      {quick.error && (
        <div className={`${CARD} p-4 mb-4 text-center space-y-2`}>
          <p className="text-sm font-semibold text-red-500">Catat Cepat gagal dimuat</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{quick.error}</p>
          <Button size="sm" onClick={quick.reload}>Coba Lagi</Button>
        </div>
      )}

      {canApprove && quick.pending.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-3 mb-4" data-testid="menunggu-persetujuan">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-2.5">
            <Clock className="w-4 h-4" /> Menunggu persetujuan
            <span className="bg-amber-600 dark:bg-amber-400 text-white dark:text-slate-900 rounded-full px-2 text-xs font-bold">{quick.pending.length}</span>
          </p>
          <div className="space-y-2">
            {quick.pending.map(r => (
              <div key={r.id} className="bg-white dark:bg-slate-900 rounded-xl p-3" data-testid="pengajuan">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{r.employeeName} <span className="font-medium text-slate-500 dark:text-slate-400">· {r.category}</span></p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{r.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Dicatat {r.requestedBy || 'staf'}{r.date !== quick.today ? ` · untuk ${r.date}` : ''}</p>
                  </div>
                  <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 shrink-0">+{formatRupiah(r.amount)}</p>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 rounded-lg px-2.5 py-1.5 mt-2">Setelah disetujui, masuk hitungan gaji {r.employeeName}.</p>
                {rejectingId === r.id ? (
                  <div className="mt-2.5 space-y-2">
                    <Input placeholder="Alasan penolakan (opsional)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="sm" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Batal</Button>
                      <Button variant="danger" size="sm" disabled={busy} onClick={() => reject(r)} icon={<X className="w-4 h-4" />}>Kirim Penolakan</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setRejectingId(r.id); setRejectReason(''); }} icon={<X className="w-4 h-4" />}>Tolak</Button>
                    <Button size="sm" disabled={busy} onClick={() => approve(r)} icon={<Check className="w-4 h-4" />}>Setujui</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-4 pt-3 pb-2 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Catatan Hari Ini</p>
          <PillTabs size="sm" value={tab} onChange={setTab} options={TABS} />
        </div>
        {feed.length === 0 ? (
          <EmptyState icon={<Wallet className="w-10 h-10" />} title="Belum ada catatan hari ini." className="py-8" />
        ) : feed.map(item => {
          const { Icon, cls, amt, sign } = KIND_ICON[item.kind];
          const masked = item.kind !== 'pengeluaran' && !canWage;
          const badge = item.kind === 'tambah' ? STATUS_BADGE[item.status] : null;
          return (
            <div key={item.key} className="flex gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800" data-testid="catatan">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cls}`}><Icon className="w-4 h-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{item.title}{item.tag && <span className="font-medium text-slate-500 dark:text-slate-400"> · {item.tag}</span>}</p>
                {item.note && <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{item.note}</p>}
                <p className="text-xs text-slate-400 dark:text-slate-500">{item.time}{item.by ? ` · dicatat ${item.by}` : ''}</p>
                {item.status === 'ditolak' && item.reason && <p className="text-xs text-red-500 mt-0.5">Alasan: {item.reason}</p>}
                {item.kind === 'tambah' && item.status === 'menunggu' && !canApprove && (
                  <button type="button" onClick={() => cancel(item)} className="text-xs font-bold text-slate-500 dark:text-slate-400 underline mt-1">Batalkan pengajuan</button>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className={`font-bold text-sm ${masked ? 'text-slate-400' : amt}`}>{masked ? MASK : `${sign}${formatRupiah(item.amount)}`}</p>
                {badge && <Badge variant={badge[0]} dot>{badge[1]}</Badge>}
              </div>
            </div>
          );
        })}
      </div>

      <ExpenseFormSheet isOpen={sheet === 'pengeluaran'} onClose={() => setSheet(null)} data={expenseData} onSaved={quick.afterExpenseSaved} />
      <QuickAdjustmentSheet isOpen={sheet === 'tambahan' || sheet === 'potongan'} kind={sheet === 'potongan' ? 'potongan' : 'tambahan'}
        onClose={() => setSheet(null)} quick={quick} canApprove={canApprove} />
    </section>
  );
}
