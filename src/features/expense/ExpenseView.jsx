import { useState, useMemo } from 'react';
import { TrendingDown, Save, Pencil, Trash2, History, ArrowUpDown, Plus } from 'lucide-react';
import { Card, Input, NominalInput, Select, Button, Badge, IconButton, EmptyState, SortModal, BulkSelectBar, Modal, BulletListInput } from '../../components/ui';
import CategoryModal from '../../components/CategoryModal';
import CategorySelect from '../../components/CategorySelect';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useExpenseData } from '../../hook/useExpenseData';
import { useBulkSelect } from '../../hook/useBulkSelect';
import { applySort } from '../../utils/sortUtils';
import { toLocalDateString } from '../../utils/formatters';

/**
 * ExpenseView — Pengeluaran. Form, filter periode, urutkan, pilih-banyak,
 * dan Kelola Kategori di-port dari mamam-global, dengan BEDA yang disengaja:
 *   - TANPA Kasbon Karyawan (dipindah ke fitur Karyawan nanti)
 *   - HARD DELETE (tanpa RecycleBin)
 *   - Edit/hapus terbuka untuk semua (belum ada login/admin di C)
 *   - Data langsung ke Supabase; kalau gagal, user diberi tahu jelas
 *
 * Tanggal pengeluaran diperlakukan sebagai string "YYYY-MM-DD" apa adanya,
 * TIDAK di-parse jadi Date UTC, supaya tidak bergeser sehari di zona waktu
 * tertentu (bug klasik pada laporan tengah malam).
 */

const dayOf = (v) => String(v).slice(0, 10);
// Detail disimpan sebagai teks, satu poin per baris. Catatan lama (satu baris) = satu poin.
const noteLines = (note) => String(note || '').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
const toItems = (note) => { const l = noteLines(note); return l.length ? l : ['']; };
const showDate = (v) => {
  const [y, m, d] = dayOf(v).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID');
};

const ExpenseView = () => {
  const { formatRupiah, triggerAlert, triggerConfirm } = useAppContext();
  const { can } = useAuth();
  const canChange = can('pengeluaran.ubah');   // edit & hapus; mencatat baru boleh semua peran
  const {
    expenses, categories, employees, loading, error, reload,
    saveExpense, deleteExpense, bulkDeleteExpenses,
    setCategoriesPersist, renameCategory, deleteCategory,
  } = useExpenseData();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [detailItems, setDetailItems] = useState(['']);
  const [dateInput, setDateInput] = useState(toLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [cashHolderId, setCashHolderId] = useState('kasir');
  const [filterMode, setFilterMode] = useState('hari-ini');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState('date-desc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { triggerAlert(e.message || 'Terjadi kesalahan.'); }
    finally { setBusy(false); }
  };

  const couriers = useMemo(
    () => employees.filter(e => e.role === 'kurir' && e.status !== 'resign'),
    [employees]
  );

  const matchesDateFilter = (date) => {
    const d = dayOf(date);
    const today = toLocalDateString();
    if (filterMode === 'semua') return true;
    if (filterMode === 'hari-ini') return d === today;
    if (filterMode === 'kemarin') {
      const y = new Date(); y.setDate(y.getDate() - 1);
      return d === toLocalDateString(y);
    }
    if (filterMode === 'bulan-ini') return d.slice(0, 7) === today.slice(0, 7);
    if (filterMode === 'tanggal-terpilih') {
      if (!filterStartDate) return true;
      const end = filterEndDate || filterStartDate;   // tanpa tanggal akhir = satu hari
      return d >= filterStartDate && d <= end;
    }
    return true;
  };

  const filtered = useMemo(() => expenses.filter(e => matchesDateFilter(e.date)),
    [expenses, filterMode, filterStartDate, filterEndDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedExpenses = useMemo(() => applySort(filtered, sortKey, {
    date: e => dayOf(e.date),
    category: e => e.category || '',
    amount: e => Number(e.amount) || 0,
  }), [filtered, sortKey]);

  const activeTotal = useMemo(() => sortedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [sortedExpenses]);

  const sortOptions = [
    { key: 'date-desc', label: 'Terbaru Dulu' },
    { key: 'date-asc', label: 'Terlama Dulu' },
    { key: 'category-asc', label: 'Kategori (A-Z)' },
    { key: 'category-desc', label: 'Kategori (Z-A)' },
    { key: 'amount-desc', label: 'Nominal Terbesar' },
  ];

  const { selectedIds, allSelected, toggleOne, toggleAll, reset: resetSelection, count } = useBulkSelect(sortedExpenses);

  const resetForm = () => {
    setEditingId(null); setAmount(''); setSupplier(''); setDetailItems(['']); setPaymentMethod('Tunai'); setCashHolderId('kasir');
    setDateInput(toLocalDateString());
    setCategory('');
  };

  const openNew = () => { resetForm(); setIsFormOpen(true); };
  const closeForm = () => { resetForm(); setIsFormOpen(false); };

  const handleSave = () => run(async () => {
    const holder = paymentMethod === 'Tunai' && cashHolderId !== 'kasir' ? couriers.find(c => c.id === cashHolderId) : null;
    await saveExpense({
      id: editingId, amount, category, note: detailItems.map(t => t.trim()).filter(Boolean).join('\n'),
      supplier: supplier.trim(), date: dateInput, paymentMethod,
      cashHolderEmployeeId: holder?.id || null, cashHolderName: holder?.name || null,
    });
    closeForm();
  });

  const handleEditClick = (exp) => {
    setEditingId(exp.id);
    setAmount(String(exp.amount));
    setCategory(exp.category);
    setSupplier(exp.supplier || '');
    setDetailItems(toItems(exp.note));
    setDateInput(dayOf(exp.date));
    setPaymentMethod(exp.paymentMethod === 'Non-Tunai' ? 'Non-Tunai' : 'Tunai');
    setCashHolderId(exp.cashHolderEmployeeId || 'kasir');
    setIsFormOpen(true);
  };

  const handleDelete = (exp) => {
    triggerConfirm('Yakin ingin menghapus catatan pengeluaran ini? Data akan hilang permanen.', () =>
      run(async () => { await deleteExpense(exp.id); if (editingId === exp.id) resetForm(); }));
  };

  const handleBulkDelete = () => {
    const ids = [...selectedIds];
    triggerConfirm(`Yakin ingin menghapus ${ids.length} catatan terpilih? Data akan hilang permanen.`, () =>
      run(async () => { await bulkDeleteExpenses(ids); resetSelection(); }));
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">Memuat pengeluaran...</div>;
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
        <p className="text-sm font-semibold text-red-500">Gagal memuat pengeluaran</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">{error}</p>
        <Button onClick={reload}>Coba Lagi</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex flex-col gap-4 w-full min-w-0 flex-1">
        <Card padding="none" className="flex flex-col flex-1 min-h-[360px] w-full min-w-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
            <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0"><History className="w-4 h-4" /> Riwayat Pengeluaran</h3>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {canChange && (
              <button onClick={() => { if (isSelecting) resetSelection(); setIsSelecting(v => !v); }}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all duration-300 active:scale-95 shrink-0 ${isSelecting ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400' : 'text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400'}`}>
                {isSelecting ? 'Batal' : 'Pilih'}
              </button>
              )}
              <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
                className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-accent-500/30 transition-all duration-200 shrink-0">
                <option value="hari-ini">Hari Ini</option>
                <option value="kemarin">Kemarin</option>
                <option value="bulan-ini">Bulan Ini</option>
                <option value="semua">Semua</option>
                <option value="tanggal-terpilih">Tanggal Terpilih</option>
              </select>
              {filterMode === 'tanggal-terpilih' && (
                <div className="flex items-center gap-1 flex-wrap min-w-0">
                  <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} max={filterEndDate || undefined}
                    className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-accent-500/30 shrink-0 min-w-0 max-w-[130px]" />
                  <span className="text-xs text-slate-400 shrink-0">-</span>
                  <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} min={filterStartDate || undefined}
                    className="p-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-accent-500/30 shrink-0 min-w-0 max-w-[130px]" />
                </div>
              )}
              <button type="button" onClick={() => setIsSortOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 transition-all duration-300 active:scale-95 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan
              </button>
            </div>
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 flex justify-between items-center">
            <span className="text-xs font-bold text-red-700 dark:text-red-300">Total Periode Ini:</span>
            <span className="text-sm font-bold text-red-700 dark:text-red-300">{formatRupiah(activeTotal)}</span>
          </div>

          {isSelecting && sortedExpenses.length > 0 && (
            <div className="px-4 pt-3">
              <BulkSelectBar count={count} total={sortedExpenses.length} allSelected={allSelected} onToggleAll={toggleAll} onDeleteSelected={handleBulkDelete} />
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {sortedExpenses.length === 0 ? (
              <EmptyState icon={<TrendingDown className="w-12 h-12" />} title="Belum ada pengeluaran pada periode ini." className="h-full animate-in fade-in duration-300" />
            ) : sortedExpenses.map(exp => (
              <div key={exp.id} className={`flex justify-between items-center p-3.5 border rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-950 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-300 ${selectedIds.has(exp.id) ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-100 dark:border-slate-800'}`}>
                <div className="flex items-start gap-2 flex-1 pr-4">
                  {isSelecting && (
                    <input type="checkbox" checked={selectedIds.has(exp.id)} onChange={() => toggleOne(exp.id)} className="w-4 h-4 mt-0.5 rounded accent-[#dc2626] cursor-pointer shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                      {exp.category}
                      <Badge variant="neutral">{showDate(exp.date)}</Badge>
                      {exp.paymentMethod === 'Non-Tunai' && <Badge variant="info">Bank</Badge>}
                      {exp.cashHolderName && <Badge variant="warning">💰 {exp.cashHolderName}</Badge>}
                    </p>
                    {exp.supplier && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">🏪 {exp.supplier}</p>}
                    {(() => {
                      const lines = noteLines(exp.note);
                      if (lines.length > 1) return <ul className="mt-1 list-disc pl-4 text-xs text-slate-500 dark:text-slate-400 space-y-0.5">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
                      if (lines.length === 1) return <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{lines[0]}</p>;
                      return exp.supplier ? null : <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tanpa catatan</p>;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-xl text-sm border border-red-100 dark:border-red-500/20">-{formatRupiah(exp.amount)}</p>
                  {canChange && (
                  <div className="flex gap-1">
                    <IconButton variant="edit" onClick={() => handleEditClick(exp)} title="Edit Catatan"><Pencil className="w-3.5 h-3.5" /></IconButton>
                    <IconButton variant="delete" onClick={() => handleDelete(exp)} title="Hapus Catatan"><Trash2 className="w-3.5 h-3.5" /></IconButton>
                  </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Button onClick={openNew} variant="danger" icon={<Plus className="w-4 h-4" />} className="w-full sm:w-auto sm:self-end">
          Tambah Pengeluaran
        </Button>
      </div>

      <Modal isOpen={isFormOpen} onClose={closeForm} sheet size="lg" maxHeight title={editingId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}>
        <div className="p-5 pt-2 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-4 items-start">
            <CategorySelect value={category} onChange={setCategory} options={categories} onManage={() => setIsCategoryModalOpen(true)} />
            <Select label="Sumber Dana" value={paymentMethod}
              onChange={e => { setPaymentMethod(e.target.value); if (e.target.value === 'Non-Tunai') setCashHolderId('kasir'); }}>
              <option value="Tunai">Tunai</option>
              <option value="Non-Tunai">Non-Tunai</option>
            </Select>
            <NominalInput label="Jumlah" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            <Input type="date" label="Tanggal Transaksi" value={dateInput} onChange={e => setDateInput(e.target.value)} />
          </div>

          {paymentMethod === 'Tunai' && couriers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Dibayar Pakai Uang Siapa?</label>
              <Select value={cashHolderId} onChange={e => setCashHolderId(e.target.value)}>
                <option value="kasir">Kasir / Toko</option>
                {couriers.map(c => <option key={c.id} value={c.id}>{c.name} (Kurir)</option>)}
              </Select>
              {cashHolderId !== 'kasir' && (
                <p className="text-xs text-accent-600 dark:text-accent-400 mt-1 italic">
                  *Dicatat pakai cash yang lagi dipegang kurir ini (belum disetor). Terlihat di rincian posisi uang pada Dompet.
                </p>
              )}
            </div>
          )}

          <Input label="Nama Toko/Supplier" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Opsional" />

          <BulletListInput label="Detail" value={detailItems} onChange={setDetailItems} placeholder="Opsional, mis. Ayam 5 kg" />

          <Button onClick={handleSave} disabled={busy} size="full" variant={editingId ? 'primary' : 'dark'} className="mt-2">
            {busy ? 'Menyimpan...' : editingId ? 'Perbarui Data' : 'Simpan Data'}
          </Button>
        </div>
      </Modal>

      <SortModal isOpen={isSortOpen} onClose={() => setIsSortOpen(false)} value={sortKey} onChange={setSortKey} options={sortOptions} />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Kelola Kategori Pengeluaran"
        categories={categories}
        setCategories={(next) => run(() => setCategoriesPersist(next))}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
        deleteMessage={(cat) => `Yakin ingin menghapus kategori "${cat}"? Catatan pengeluaran lama tetap tersimpan dengan nama kategori ini.`}
        onRenameAsync={(oldCat, newCat) => {
          run(() => renameCategory(oldCat, newCat));
          if (category === oldCat) setCategory(newCat);
        }}
        onDeleteAsync={(deletedCat) => {
          run(() => deleteCategory(deletedCat));
          if (category === deletedCat) setCategory(categories.find(c => c !== deletedCat) || '');
        }}
      />
    </div>
  );
};

export default ExpenseView;
