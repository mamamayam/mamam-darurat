import { useState, useEffect, useRef } from 'react';
import { X, Search, UserPlus, User } from 'lucide-react';
import { usePosStore } from '../../store/usePosStore';
import useBackLayer from '../../hook/useBackLayer';
import Overlay from '../../components/ui/Overlay';
import Button from '../../components/ui/Button';

/**
 * CustomerPickerModal — di-port dari mamam-global dengan alasan desain
 * yang SAMA dipertahankan penuh: kolom cari tidak pernah langsung jadi
 * customerName tersimpan, hanya 3 aksi eksplisit yang commit (pilih dari
 * list, tambah baru, atau Tamu).
 *
 * BEDA dari A:
 *  - Sumber pelanggan adalah `customers` dari useCustomerData (Supabase),
 *    diterima lewat props — bukan state lokal AppContext.
 *  - Badge poin dihapus (poin ditunda ke gelombang berikutnya).
 *  - "Tambah baru" memanggil saveCustomer() yang menulis ke server dan
 *    menunggu hasilnya (bisa gagal kalau internet putus), bukan langsung
 *    commit ke array lokal.
 */
export default function CustomerPickerModal({ isOpen, onClose, customers, saveCustomer, triggerAlert }) {
  const setCustomerName = usePosStore((s) => s.setCustomerName);
  const setSelectedCustomerId = usePosStore((s) => s.setSelectedCustomerId);
  const selectedCustomerId = usePosStore((s) => s.selectedCustomerId);

  const [query, setQuery] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Back = sama dengan tombol X (handleClose): kosongkan pencarian lalu tutup.
  useBackLayer(isOpen, () => { setQuery(''); setNewPhone(''); onClose(); });

  if (!isOpen) return <Overlay open={false} />; // tetap terpasang sampai animasi keluar selesai

  const handleClose = () => { setQuery(''); setNewPhone(''); onClose(); };

  const q = query.trim().toLowerCase();
  const matches = q
    ? customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(query.trim())))
    : customers;

  const handleSelect = (customer) => {
    setCustomerName(customer.name);
    setSelectedCustomerId(customer.id);
    handleClose();
  };

  const handleGuest = () => {
    setCustomerName('');
    setSelectedCustomerId(null);
    handleClose();
  };

  const handleAddNew = async () => {
    const name = query.trim();
    if (!name || busy) return;
    const exists = customers.some(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) return triggerAlert('Nama ini sudah terdaftar. Pilih dari daftar di atas, ya.');

    setBusy(true);
    try {
      await saveCustomer({ name, phone: newPhone.trim() });
      // saveCustomer mem-reload daftar; cari record barunya untuk langsung dipilih
      const created = customers.find(c => c.name === name) || { name };
      setCustomerName(created.name);
      setSelectedCustomerId(created.id || null);
      handleClose();
    } catch (e) {
      triggerAlert(e.message || 'Gagal menambah pelanggan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay
      open variant="responsive" z="z-[70]" containerClass="items-end md:items-center justify-center" onClose={handleClose}
      backdropClass="bg-black/40 backdrop-blur-md"
      panelClass="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
    >
      <>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Pilih Pelanggan</h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={searchInputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / no. HP..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-accent-500 dark:focus:border-accent-400 transition-colors" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2 custom-scrollbar">
          <button onClick={handleGuest}
            className={`w-full flex items-center gap-2 p-3 rounded-xl border mb-2 text-left transition-colors ${
              !selectedCustomerId ? 'border-accent-300 bg-accent-50 dark:bg-accent-500/10 dark:border-accent-500/30' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
            }`}>
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Lanjut sebagai Tamu</span>
          </button>

          {matches.length > 0 ? (
            <div className="space-y-1.5">
              {matches.map(c => (
                <div key={c.id} onClick={() => handleSelect(c)}
                  className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedCustomerId === c.id ? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-accent-200 dark:hover:border-accent-500/30'
                  }`}>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{c.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{c.phone || 'Tanpa No. HP'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : q ? (
            <div className="text-center py-6 text-xs text-slate-400">Gak ada pelanggan cocok dengan "{query}"</div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">Belum ada pelanggan terdaftar</div>
          )}
        </div>

        {q && matches.length === 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-blue-50/50 dark:bg-blue-500/5">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5" /> Tambahkan "{query}" sebagai pelanggan baru
            </p>
            <div className="flex gap-2">
              <input type="text" placeholder="No. WhatsApp (opsional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                className="flex-1 text-xs p-2.5 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 transition-colors" />
              <Button variant="secondary" size="sm" onClick={handleAddNew} disabled={busy} className="shrink-0">
                {busy ? '...' : 'Tambah'}
              </Button>
            </div>
          </div>
        )}
      </>
    </Overlay>
  );
}
