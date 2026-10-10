import { PillTabs, Input, NominalInput } from '../../components/ui';
import CategorySelect from '../../components/CategorySelect';

/**
 * AdjustmentFields — isian Tambahan/Potongan gaji (jenis, kategori yang bisa dikelola,
 * keterangan, nominal, tanggal). Dipakai form di Penggajian DAN sheet Tambah/Potongan di
 * Beranda, supaya keduanya selalu sama persis.
 *
 * `form` = { type: 'potongan' | 'tambahan', category, label, amount, date }
 * `categories` = { tambahan: string[], potongan: string[] } (usePayrollCategories().categories)
 * `lockType` = sembunyikan pilihan Tambahan/Potongan (dipakai saat MENGUBAH catatan yang sudah ada: jenisnya tidak boleh berganti)
 */
export default function AdjustmentFields({ form, onChange, categories, onManage, minDate, maxDate, labelPlaceholder = 'Keterangan', lockType = false }) {
  const firstCat = (type) => (categories[type] || [])[0] || '';
  return (
    <>
      {!lockType && (
        <PillTabs value={form.type} onChange={(v) => onChange({ ...form, type: v, category: firstCat(v) })}
          options={[{ value: 'tambahan', label: 'Tambahan' }, { value: 'potongan', label: 'Potongan' }]} />
      )}
      <CategorySelect value={form.category} onChange={(v) => onChange({ ...form, category: v })} options={categories[form.type] || []} onManage={onManage} />
      <Input placeholder={labelPlaceholder} value={form.label} onChange={e => onChange({ ...form, label: e.target.value })} />
      <NominalInput title="Nominal" placeholder="Nominal" value={form.amount} onChange={e => onChange({ ...form, amount: e.target.value })} />
      <Input type="date" value={form.date} min={minDate} max={maxDate} onChange={e => onChange({ ...form, date: e.target.value })} />
    </>
  );
}
