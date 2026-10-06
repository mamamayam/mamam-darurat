import { useState, useMemo } from 'react';
import { Users, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Card, Input, Button, EmptyState, BulkSelectBar, Modal } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { useCustomerData } from '../../hook/useCustomerData';
import { useBulkSelect } from '../../hook/useBulkSelect';

/**
 * CustomerView — Pelanggan, gelombang 1. Kolom "Kelola Pelanggan" di-port
 * dari mamam-global (search, tambah inline, edit lewat popup, bulk delete),
 * dengan BEDA yang disengaja:
 *   - TANPA poin (kolom "X Poin" & kartu "Aturan Poin & Ketentuan Reward"
 *     dihapus) — poin hidup di project mamam-global, integrasi menyusul.
 *   - TANPA tab Voucher & Loyal Customers — nyusul, belum jadi kebutuhan
 *     "track harian" gelombang 1.
 *   - HARD DELETE (tanpa RecycleBin): tombol hapus = hilang permanen dari
 *     Supabase saat itu juga, bukan soft-delete yang bisa dipulihkan.
 */
const CustomerView = () => {
  const { triggerAlert, triggerConfirm } = useAppContext();
  const { customers, loading, error, reload, saveCustomer, deleteCustomer, bulkDeleteCustomers } = useCustomerData();

  const [search, setSearch] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [editing, setEditing] = useState(null); // form tambah/edit: { id ('' = baru), name, phone } | null
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { triggerAlert(e.message || 'Terjadi kesalahan.'); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)) : customers;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search]);

  const { selectedIds, allSelected, toggleOne, toggleAll, reset, count } = useBulkSelect(filtered);

  const handleSave = () => run(async () => {
    await saveCustomer({ id: editing.id || undefined, name: editing.name, phone: editing.phone });
    setEditing(null);
  });

  const handleDelete = (c) => {
    triggerConfirm(`Yakin ingin menghapus pelanggan "${c.name}"? Riwayat transaksinya tetap tersimpan.`, () =>
      run(async () => { await deleteCustomer(c.id); if (editing?.id === c.id) setEditing(null); }));
  };

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    triggerConfirm(`Yakin ingin menghapus ${ids.length} pelanggan terpilih?`, () =>
      run(async () => { await bulkDeleteCustomers(ids); reset(); }));
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">Memuat pelanggan...</div>;
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
        <p className="text-sm font-semibold text-red-500">Gagal memuat pelanggan</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">{error}</p>
        <Button onClick={reload}>Coba Lagi</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col min-h-0 relative animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <Users className="w-6 h-6 text-accent-500 dark:text-accent-400" />
        <h2 className="font-heading text-xl font-black text-slate-800 dark:text-slate-100">Pelanggan</h2>
      </div>

      <Card padding="none" className="flex flex-col flex-1 min-h-0 max-w-2xl w-full">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text" placeholder="Cari nama / no. HP..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full text-sm pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors text-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            onClick={() => { if (isSelecting) reset(); setIsSelecting(v => !v); }}
            className={`text-xs font-bold px-3 py-2.5 rounded-xl border transition-colors shrink-0 ${isSelecting ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30' : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-accent-600 dark:hover:text-accent-400'}`}
          >
            {isSelecting ? 'Batal' : 'Pilih'}
          </button>
          <button
            onClick={() => setEditing({ id: '', name: '', phone: '' })} title="Tambah Pelanggan"
            className="px-3 py-2.5 text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 duration-300 transition-colors flex items-center justify-center gap-1 shrink-0 bg-accent-600 dark:bg-accent-500 hover:bg-accent-700 dark:hover:bg-accent-600"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-slate-50 dark:bg-slate-950/30 custom-scrollbar">
          {isSelecting && filtered.length > 0 && (
            <BulkSelectBar count={count} total={filtered.length} allSelected={allSelected} onToggleAll={toggleAll} onDeleteSelected={handleBulkDelete} />
          )}
          {filtered.map(cust => (
            <div key={cust.id} className={`flex justify-between items-center p-3 bg-white dark:bg-slate-900 border rounded-xl shadow-sm hover:border-accent-200 dark:hover:border-accent-500/30 transition-all duration-300 ${selectedIds.has(cust.id) ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className="flex items-start gap-2">
                {isSelecting && (
                  <input type="checkbox" checked={selectedIds.has(cust.id)} onChange={() => toggleOne(cust.id)} className="w-4 h-4 mt-0.5 rounded accent-orange-500 cursor-pointer shrink-0" />
                )}
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{cust.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{cust.phone || 'Tanpa No. HP'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing({ id: cust.id, name: cust.name, phone: cust.phone || '' })} title="Edit Pelanggan"
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(cust)} title="Hapus Pelanggan"
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <EmptyState size="sm" title={search ? 'Pelanggan tidak ditemukan.' : 'Belum ada pelanggan'} />
          )}
        </div>
      </Card>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} sheet size="lg" maxHeight title={editing?.id ? 'Edit Data Pelanggan' : 'Tambah Pelanggan'}>
        {editing && (
          <div className="p-5 pt-2 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <Input label="Nama Pelanggan" variant="muted" type="text" placeholder="Nama Pelanggan" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <Input label="No. Whatsapp" variant="muted" type="text" placeholder="No. Whatsapp" value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
            <Button size="full" onClick={handleSave} disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomerView;
