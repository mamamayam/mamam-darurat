import { useState, useEffect } from 'react';
import { Modal, Button, Select } from '../../components/ui';
import CategoryModal from '../../components/CategoryModal';
import AdjustmentFields from '../payroll/AdjustmentFields';
import { usePayrollCategories } from '../../hook/usePayrollCategories';
import { useAppContext } from '../../context/AppContext';
import { toLocalDateString } from '../../utils/formatters';
import { PAYMENT_METHODS } from './quickEntryMath';

/**
 * QuickAdjustmentSheet — form Tambah / Potongan karyawan dari Beranda (bottom sheet).
 * Isian jenis, kategori (bisa dikelola), keterangan, nominal, dan tanggal = komponen yang
 * sama dengan form di Penggajian (AdjustmentFields). Tambahannya hanya pilihan karyawan,
 * Sumber Dana (khusus Potongan), dan "Dicatat oleh" (staf yang mengajukan Tambah).
 *
 * Aturan:
 *  - Tambah: owner langsung disetujui; staf = pengajuan, menunggu persetujuan owner.
 *  - Potongan: langsung dicatat, sekaligus jadi pengeluaran karyawan; tunai mengurangi Dompet.
 *
 * Sheet memakai Modal bersama: tombol Back HP menutupnya dan bisa di-swipe turun.
 */
const emptyForm = (type) => ({ type, label: '', amount: '', date: toLocalDateString(), category: '' });   // category '' = pilihan pertama

export default function QuickAdjustmentSheet({ isOpen, kind, onClose, quick, canApprove }) {
  const { triggerAlert, triggerConfirm } = useAppContext();
  const cats = usePayrollCategories();
  const firstCat = (type) => (cats.categories[type] || [])[0] || '';

  const [form, setForm] = useState(() => emptyForm(kind));
  const [employeeId, setEmployeeId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [requestedBy, setRequestedBy] = useState('');
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Tiap dibuka: form bersih sesuai tile yang ditekan. "Dicatat oleh" mengingat pilihan terakhir.
  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyForm(kind)); setEmployeeId(''); setPaymentMethod('Tunai');
    setRequestedBy(quick.lastRequester.current || '');
  }, [isOpen, kind]); // eslint-disable-line react-hooks/exhaustive-deps -- reset hanya saat dibuka

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { triggerAlert(e.message || 'Terjadi kesalahan.'); }
    finally { setBusy(false); }
  };

  const category = form.category || firstCat(form.type);
  const isAddition = form.type === 'tambahan';
  const needsApproval = isAddition && !canApprove;

  const handleSubmit = () => run(async () => {
    const f = { employeeId, category, label: form.label, amount: form.amount, date: form.date, requestedBy, paymentMethod };
    if (isAddition) {
      const status = await quick.submitAddition(f);
      onClose();
      if (status === 'menunggu') triggerAlert('Terkirim ke owner. Tambahan baru dihitung di gaji setelah disetujui.');
    } else {
      await quick.submitDeduction(f);
      onClose();
    }
  });

  const hint = isAddition
    ? (needsApproval
      ? 'Menunggu persetujuan owner. Belum masuk hitungan gaji sampai disetujui.'
      : 'Kamu owner, jadi langsung disetujui dan masuk hitungan gaji.')
    : (paymentMethod === 'Tunai'
      ? 'Langsung dicatat sebagai pengeluaran karyawan dan memotong gaji. Karena tunai, saldo Dompet ikut berkurang.'
      : 'Langsung dicatat sebagai pengeluaran karyawan dan memotong gaji (non-tunai, tidak menyentuh Dompet).');

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} sheet size="lg" maxHeight title={isAddition ? 'Catat Tambahan' : 'Catat Potongan'}>
        <div className="p-5 pt-2 space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Select label="Karyawan" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">Pilih karyawan</option>
            {quick.employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </Select>

          <AdjustmentFields form={{ ...form, category }} onChange={setForm} categories={cats.categories} onManage={() => setCatModalOpen(true)} />

          {!isAddition && (
            <Select label="Sumber Dana" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          )}

          {needsApproval && (
            <Select label="Dicatat oleh" value={requestedBy} onChange={e => setRequestedBy(e.target.value)}>
              <option value="">Pilih namamu</option>
              {quick.employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
            </Select>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-xl p-3" data-testid="quick-hint">{hint}</p>

          <Button size="full" variant={isAddition ? 'success' : 'danger'} onClick={handleSubmit} disabled={busy}>
            {busy ? 'Menyimpan...' : needsApproval ? 'Ajukan ke Owner' : isAddition ? 'Simpan Tambahan' : 'Simpan Potongan'}
          </Button>
        </div>
      </Modal>

      <CategoryModal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={`Kelola Kategori ${isAddition ? 'Tambahan' : 'Potongan'}`}
        categories={cats.categories[form.type] || []}
        setCategories={(next) => run(() => cats.setCategoriesPersist(form.type, next))}
        triggerAlert={triggerAlert}
        triggerConfirm={triggerConfirm}
        deleteMessage={(cat) => `Yakin ingin menghapus kategori "${cat}"? Catatan lama tetap tersimpan dengan nama kategori ini.`}
        onRenameAsync={(oldCat, newCat) => {
          run(() => cats.renameCategory(form.type, oldCat, newCat));
          if (category === oldCat) setForm(f => ({ ...f, category: newCat }));
        }}
        onDeleteAsync={(deletedCat) => {
          run(() => cats.deleteCategory(form.type, deletedCat));
          if (category === deletedCat) setForm(f => ({ ...f, category: (cats.categories[f.type] || []).find(c => c !== deletedCat) || '' }));
        }}
      />
    </>
  );
}
