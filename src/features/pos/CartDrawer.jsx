import { useState, useEffect } from 'react';
import {
  ShoppingCart, Trash2, X, Award, Truck, Edit3, Minus, Plus, Ticket, ChevronRight, Users, Pencil,
} from 'lucide-react';
import { usePosStore } from '../../store/usePosStore';
import { computeOrderTotals } from './posMath';
import useBackLayer from '../../hook/useBackLayer';
import CustomerPickerModal from './CustomerPicker';
import NominalInput from '../../components/ui/NominalInput';

/**
 * CartDrawer — di-port dari mamam-global, DIPANGKAS sesuai scope
 * gelombang 1 Aplikasi C:
 *  - TANPA "Simpan Bill" (savedBills) — sesuai keputusan: checkout
 *    langsung selesai atau batal. Draft cart tetap aman lewat
 *    usePosStore (persist localStorage), bukan lewat mekanisme bill
 *    terpisah.
 *  - TANPA Klaim Poin (poin ditunda ke gelombang berikutnya).
 *  - TANPA pajak/service charge (di luar scope gelombang 1).
 *  - Voucher tetap ada (kolomnya sudah di skema, dipakai checkout),
 *    tapi manajemen voucher sendiri belum ada UI-nya.
 */
export default function CartDrawer({ menus, customers, saveCustomer, vouchers, employees, triggerAlert, triggerConfirm, formatRupiah }) {
  const cart = usePosStore((s) => s.cart);
  const setCart = usePosStore((s) => s.setCart);
  const isCartOpen = usePosStore((s) => s.isCartOpen);
  const setIsCartOpen = usePosStore((s) => s.setIsCartOpen);
  const setSelectedMenuForVariant = usePosStore((s) => s.setSelectedMenuForVariant);
  const setVariantSelectedOptions = usePosStore((s) => s.setVariantSelectedOptions);
  const setEditingCartItemId = usePosStore((s) => s.setEditingCartItemId);
  const setPaymentModal = usePosStore((s) => s.setPaymentModal);

  const customerName = usePosStore((s) => s.customerName);
  const setCustomerName = usePosStore((s) => s.setCustomerName);
  const selectedCustomerId = usePosStore((s) => s.selectedCustomerId);
  const setSelectedCustomerId = usePosStore((s) => s.setSelectedCustomerId);
  const orderType = usePosStore((s) => s.orderType);
  const setOrderType = usePosStore((s) => s.setOrderType);
  const deliveryFee = usePosStore((s) => s.deliveryFee);
  const setDeliveryFee = usePosStore((s) => s.setDeliveryFee);
  const customDeliveryFee = usePosStore((s) => s.customDeliveryFee);
  const setCustomDeliveryFee = usePosStore((s) => s.setCustomDeliveryFee);
  const setDeliveryCourierId = usePosStore((s) => s.setDeliveryCourierId);
  const setDeliveryPaidTo = usePosStore((s) => s.setDeliveryPaidTo);
  const updateCartQty = usePosStore((s) => s.updateCartQty);
  const updateCartItemNote = usePosStore((s) => s.updateCartItemNote);
  const manualDiscount = usePosStore((s) => s.manualDiscount);
  const setManualDiscount = usePosStore((s) => s.setManualDiscount);
  const voucherCode = usePosStore((s) => s.voucherCode);
  const setVoucherCode = usePosStore((s) => s.setVoucherCode);
  const resetDraft = usePosStore((s) => s.resetDraft);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [voucherInput, setVoucherInput] = useState(voucherCode);

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const appliedVoucher = vouchers.find(v => v.code === voucherCode) || null;

  const totals = computeOrderTotals({ cart, voucher: appliedVoucher, manualDiscount, orderType, deliveryFee });

  const handleClearCustomer = () => { setCustomerName(''); setSelectedCustomerId(null); };

  const handleEditVariant = (cartItem) => {
    const originalMenu = menus.find(m => m.id === cartItem.menuId);
    if (originalMenu) {
      setSelectedMenuForVariant(originalMenu);
      setVariantSelectedOptions(cartItem.variantSelectedOptions || {});
      setEditingCartItemId(cartItem.cartItemId);
      setIsCartOpen(false);
    }
  };

  const handleApplyVoucher = () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    const found = vouchers.find(v => v.code === code);
    if (!found) return triggerAlert('Voucher tidak ditemukan.');
    if (totals.subtotal < found.min_purchase) {
      return triggerAlert(`Minimal belanja untuk voucher ini: ${formatRupiah(found.min_purchase)}`);
    }
    setVoucherCode(code);
    triggerAlert(`Voucher ${code} berhasil dipasang!`);
  };

  useBackLayer(isCartOpen, () => setIsCartOpen(false));

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="absolute inset-0 bg-slate-500/40 dark:bg-slate-800/40 backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsCartOpen(false)} />
      <div className="w-full md:w-[420px] bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300 ease-out">

        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <h2 className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-slate-800 dark:text-slate-100" /> Keranjang Pesanan
          </h2>
          <div className="flex gap-2">
            {cart.length > 0 && (
              <button onClick={() => triggerConfirm('Hapus semua isi keranjang? Data pelanggan & pesanan ikut direset.', resetDraft)}
                className="p-2 text-accent-500 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 rounded-full transition-colors" title="Kosongkan Keranjang">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/50">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20 text-slate-400 dark:text-slate-500" />
              <p className="text-slate-400 dark:text-slate-500">Keranjang masih kosong</p>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {/* --- CUSTOMER PICKER --- */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Pelanggan</label>
                {activeCustomer ? (
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setIsCustomerModalOpen(true)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{activeCustomer.name}</span>
                    </button>
                    <button onClick={() => setIsCustomerModalOpen(true)} title="Ganti pelanggan" className="p-1.5 text-slate-400 hover:text-accent-500 dark:hover:text-accent-400 transition-colors shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={handleClearCustomer} title="Hapus pilihan pelanggan" className="p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => setIsCustomerModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-accent-400 dark:hover:border-accent-500 text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 text-xs font-bold transition-colors">
                    <Users className="w-3.5 h-3.5" /> Pilih / Tambah Pelanggan
                  </button>
                )}
                {customerName.trim() !== '' && !activeCustomer && (
                  <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500 italic">Guest — bayar sebagai "{customerName}".</p>
                )}
              </div>

              <CustomerPickerModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)}
                customers={customers} saveCustomer={saveCustomer} triggerAlert={triggerAlert} />

              {/* --- ORDER TYPE --- */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Tipe Pesanan</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Takeaway', 'Dine-in', 'Delivery', 'Ojol'].map(type => (
                    <button key={type} onClick={() => {
                      setOrderType(type);
                      if (type !== 'Delivery') { setDeliveryFee(0); setCustomDeliveryFee(''); setDeliveryCourierId(''); setDeliveryPaidTo('kasir'); }
                      if (type === 'Ojol') { setVoucherCode(''); setVoucherInput(''); setManualDiscount({ type: 'fixed', value: 0 }); }
                    }}
                      className={`py-2 px-3 text-sm rounded-xl font-bold transition-all duration-200 ${orderType === type
                        ? 'bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-500/30 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {orderType === 'Delivery' && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-accent-100 dark:border-accent-500/20 animate-in slide-in-from-top-3 duration-300">
                  <label className="block text-xs font-bold text-accent-600 dark:text-accent-400 uppercase tracking-wider mb-3 flex items-center gap-1"><Truck className="w-3 h-3" /> Biaya Pengiriman</label>
                  <div className="flex overflow-x-auto pb-2 gap-2 snap-x hide-scrollbar">
                    {[0, 3000, 5000].map(fee => (
                      <button key={fee} onClick={() => { setDeliveryFee(fee); setCustomDeliveryFee(''); }}
                        className={`snap-center shrink-0 py-2 px-4 rounded-xl border font-bold text-sm transition-all whitespace-nowrap ${deliveryFee === fee && !customDeliveryFee ? 'bg-accent-600 dark:bg-accent-500 text-white border-accent-600 dark:border-accent-500 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-950'}`}>
                        {fee === 0 ? 'Gratis' : formatRupiah(fee)}
                      </button>
                    ))}
                    <div className="snap-center shrink-0 flex items-center gap-2 border rounded-xl px-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[140px]">
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-bold pl-2">Rp</span>
                      <NominalInput bare title="Biaya Pengiriman Custom" placeholder="Custom" className="w-full py-2 bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-slate-200 text-left"
                        value={customDeliveryFee} onChange={(e) => { setCustomDeliveryFee(e.target.value); setDeliveryFee(Number(e.target.value) || 0); }} />
                    </div>
                  </div>
                </div>
              )}

              {/* --- CART ITEMS --- */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Daftar Pesanan</label>
                {cart.map((item) => (
                  <div key={item.cartItemId} className="flex justify-between items-start border-b border-slate-50 dark:border-slate-900 pb-3 last:border-0 last:pb-0 animate-in fade-in duration-300">
                    <div className="flex-1 pr-2">
                      <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{item.name}</h4>
                      {item.variantName && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{item.variantName}</p>
                          <button onClick={() => handleEditVariant(item)} className="p-1 bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 rounded hover:bg-accent-100 dark:hover:bg-accent-500/20 transition-colors" title="Edit Varian"><Edit3 className="w-3 h-3" /></button>
                        </div>
                      )}
                      <p className="text-sm font-bold text-accent-600 dark:text-accent-400 mt-1">{formatRupiah(item.price)}</p>
                      <div className="w-full mt-2 flex items-center gap-1.5">
                        <Edit3 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <input type="text" value={item.note || ''} onChange={(e) => updateCartItemNote(item.cartItemId, e.target.value)}
                          placeholder="Catatan pesanan (opsional)..."
                          className="flex-1 text-xs bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-accent-500 dark:focus:border-accent-500 outline-none pb-0.5 text-slate-600 dark:text-slate-300 transition-colors" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 rounded-lg p-1 border border-slate-100 dark:border-slate-800">
                      <button onClick={() => updateCartQty(item.cartItemId, item.qty - 1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-900 rounded shadow-sm text-slate-600 dark:text-slate-300 hover:text-accent-600 dark:hover:text-accent-400 transition-colors shrink-0"><Minus className="w-3 h-3" /></button>
                      <NominalInput bare title={`Jumlah — ${item.name}`} prefix={null} calculator={false} maxDigits={3} value={item.qty}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          updateCartQty(item.cartItemId, n >= 1 ? n : 1);
                        }}
                        className="w-8 text-center font-bold text-sm bg-transparent outline-none focus:ring-2 focus:ring-accent-500/20 rounded transition-colors" />
                      <button onClick={() => updateCartQty(item.cartItemId, item.qty + 1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-900 rounded shadow-sm text-slate-600 dark:text-slate-300 hover:text-green-500 dark:hover:text-green-400 transition-colors shrink-0"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* --- DISCOUNTS --- */}
              {orderType !== 'Ojol' && (
                <div className="flex flex-col space-y-3">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> Kode Voucher</span>
                    <div className="flex items-center gap-1.5">
                      <input type="text" placeholder="VOUCHER" value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none uppercase" />
                      <button onClick={handleApplyVoucher} className="px-2.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors shrink-0">Pasang</button>
                    </div>
                    {appliedVoucher && <span className="text-xs text-green-500 dark:text-green-400 font-bold flex items-center gap-0.5 animate-in fade-in">Aktif: -{appliedVoucher.discount_type === 'percent' ? `${appliedVoucher.discount_value}%` : formatRupiah(appliedVoucher.discount_value)}</span>}
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col space-y-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Diskon Tambahan Manual</span>
                    <div className="flex items-center gap-1.5">
                      <select className="w-20 text-xs font-bold bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors" value={manualDiscount.type} onChange={e => setManualDiscount({ ...manualDiscount, type: e.target.value })}>
                        <option value="fixed">Rp</option>
                        <option value="percent">%</option>
                      </select>
                      <NominalInput bare title="Diskon Tambahan Manual"
                        prefix={manualDiscount.type === 'percent' ? null : 'Rp'} suffix={manualDiscount.type === 'percent' ? '%' : ''}
                        max={manualDiscount.type === 'percent' ? 100 : null} calculator={manualDiscount.type !== 'percent'}
                        placeholder="Nominal Diskon Tambahan..." value={manualDiscount.value || ''} onChange={(e) => setManualDiscount({ ...manualDiscount, value: Number(e.target.value) || 0 })}
                        className="w-full text-left truncate text-xs font-bold bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors" />
                    </div>
                    {totals.manualDiscountAmount > 0 && <span className="text-xs text-blue-600 dark:text-blue-400 font-bold block animate-in fade-in">Potongan: -{formatRupiah(totals.manualDiscountAmount)}</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- CHECKOUT SUMMARY --- */}
        {cart.length > 0 && (
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] animate-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-1.5 mb-4 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Subtotal</span><span className="font-semibold">{formatRupiah(totals.subtotal)}</span></div>
              {appliedVoucher && <div className="flex justify-between text-green-500 dark:text-green-400"><span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Diskon ({appliedVoucher.code})</span><span className="font-semibold">-{formatRupiah(totals.voucherDiscount)}</span></div>}
              {totals.manualDiscountAmount > 0 && <div className="flex justify-between text-blue-500 dark:text-blue-400"><span className="flex items-center gap-1"><Minus className="w-3 h-3" /> Diskon Tambahan</span><span className="font-semibold">-{formatRupiah(totals.manualDiscountAmount)}</span></div>}
              {orderType === 'Delivery' && <div className="flex justify-between text-accent-600 dark:text-accent-400"><span>Ongkir</span><span className="font-semibold">{formatRupiah(totals.deliveryFee)}</span></div>}
              <div className="flex justify-between text-lg font-bold text-slate-800 dark:text-slate-100 border-t border-slate-100 dark:border-slate-800 pt-2 mt-2"><span>Total Tagihan</span><span className="text-accent-600 dark:text-accent-400">{formatRupiah(totals.total)}</span></div>
            </div>
            <button
              onClick={() => setPaymentModal({ isOpen: true, isSplitMode: false, splitPayments: [], method: orderType === 'Ojol' ? 'Ojol' : 'Tunai', amountPaid: '', ojolPlatform: '', orderNumber: '' })}
              className="w-full py-3.5 rounded-xl bg-accent-600 dark:bg-accent-500 text-white font-bold shadow-lg hover:bg-accent-700 dark:hover:bg-accent-600 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
              Bayar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
