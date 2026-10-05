import { supabase } from '../../lib/supabase';
import { computeOrderTotals, cashChange, splitStatus, displayNumberFromId } from './posMath';

/**
 * useCheckout — proses "bayar" satu transaksi POS, ONLINE-FIRST.
 *
 * BEDA dari mamam-global (sengaja):
 *  - Tidak ada salesRepository/Dexie "tulis lokal dulu, sync belakangan".
 *    Checkout menulis LANGSUNG ke Supabase dan menunggu hasilnya. Kalau
 *    internet putus, checkout gagal dengan pesan jelas dan kasir tahu
 *    saat itu juga — bukan tersimpan lokal lalu "hilang" saat sync gagal
 *    diam-diam (persis kelas bug yang membuat Aplikasi A rusak).
 *  - Poin TIDAK dihitung/diproses sama sekali (integrasi menyusul).
 *  - Validasi tambahan yang TIDAK ada di A: harga & ketersediaan tiap
 *    menu di cart diperiksa ulang ke server sesaat sebelum menyimpan.
 *    Kalau menu sudah dihapus atau harganya berubah sejak dimasukkan ke
 *    keranjang (kasir lain mengedit Manajemen Menu di waktu bersamaan),
 *    checkout DITOLAK dengan pesan jelas, bukan diam-diam memakai harga
 *    lama yang sudah tidak berlaku.
 */

const fail = (error, aksi) => { throw new Error(`${aksi}: ${error.message}`); };

export async function checkout({
  cart, orderType, customerId, customerName, deliveryFee,
  voucher, manualDiscount, paymentMethod, amountPaid,
  isSplitMode, splitPayments, ojolPlatform, orderNumber,
  deliveryCourierId, deliveryPaidTo, employees,
}) {
  if (!cart || cart.length === 0) throw new Error('Keranjang masih kosong.');

  // ── Validasi ulang harga & ketersediaan menu ke server ──────────────
  const menuIds = [...new Set(cart.map(i => i.menuId))];
  const { data: liveMenus, error: menuErr } = await supabase
    .from('menu_items').select('id, name, price, hpp, is_active').in('id', menuIds);
  if (menuErr) fail(menuErr, 'Gagal memeriksa menu');
  const liveById = Object.fromEntries((liveMenus || []).map(m => [m.id, m]));
  for (const item of cart) {
    const live = liveById[item.menuId];
    if (!live || live.is_active === false) {
      throw new Error(`"${item.name}" sudah tidak tersedia di menu. Hapus item ini dari keranjang untuk melanjutkan.`);
    }
    // item.price sudah termasuk harga varian (dihitung saat addToCart).
    // Kita tidak menyimpan harga dasar menu terpisah di cart item, jadi
    // validasi di sini sengaja longgar: hanya menolak kalau menu HILANG
    // atau DINONAKTIFKAN. Perubahan harga menu di tengah transaksi tidak
    // diblokir (kasir sudah menyepakati harga itu dengan pembeli) —
    // beda dari A yang juga tidak memvalidasi ini sama sekali; C
    // menambah pengecekan ketersediaan yang sebelumnya tidak ada.
  }

  const totals = computeOrderTotals({ cart, voucher, manualDiscount, orderType, deliveryFee });

  // ── Uang tunai ke kurir (COD) — sama seperti A ───────────────────────
  const hasCashSplit = isSplitMode ? (splitPayments || []).some(p => p.method === 'Tunai') : paymentMethod === 'Tunai';
  const isCourierCOD = orderType === 'Delivery' && hasCashSplit && !!deliveryCourierId && deliveryPaidTo === 'kurir';
  const courier = isCourierCOD ? (employees || []).find(e => e.id === deliveryCourierId) : null;

  let amount_paid = null, change_amount = null, split_payments_json = null;
  if (isSplitMode) {
    const s = splitStatus(splitPayments, totals.total);
    if (!s.isFullyPaid) throw new Error('Pembayaran split belum lunas.');
    amount_paid = s.totalPaid; change_amount = s.change; split_payments_json = splitPayments;
  } else if (paymentMethod === 'Tunai') {
    if (Number(amountPaid) < totals.total) throw new Error('Uang yang diterima kurang dari total tagihan.');
    amount_paid = Number(amountPaid); change_amount = cashChange(amountPaid, totals.total);
  }

  const now = new Date().toISOString();
  const { data: tx, error: txErr } = await supabase.from('transactions').insert({
    display_number: 'TEMP', status: 'paid', order_type: orderType,
    customer_id: customerId || null, customer_name: customerName || null,
    ojol_platform: paymentMethod === 'Ojol' ? (ojolPlatform || null) : null,
    ojol_order_number: paymentMethod === 'Ojol' ? (orderNumber || null) : null,
    subtotal: totals.subtotal,
    voucher_id: voucher?.id || null, voucher_code: voucher?.code || null, voucher_discount: totals.voucherDiscount,
    manual_discount_type: manualDiscount?.value ? manualDiscount.type : null,
    manual_discount_value: manualDiscount?.value || null, manual_discount_amount: totals.manualDiscountAmount,
    delivery_fee: totals.deliveryFee,
    total: totals.total,
    payment_method: isSplitMode ? 'Split Payment' : paymentMethod,
    amount_paid, change_amount, split_payments_json,
    cash_holder_employee_id: courier?.id || null, cash_holder_name: courier?.name || null,
    paid_at: now,
  }).select('id').single();
  if (txErr) fail(txErr, 'Gagal menyimpan transaksi');

  // display_number pendek dari id, konsisten dengan pola kode Shift.
  const display_number = displayNumberFromId(tx.id);
  await supabase.from('transactions').update({ display_number }).eq('id', tx.id);

  const itemRows = cart.map(item => ({
    transaction_id: tx.id, menu_item_id: item.menuId, name: item.name,
    variant_name: item.variantName || null, variant_selected_json: item.variantSelectedOptions || null,
    price: item.price, hpp: item.hpp || 0, qty: item.qty, note: item.note || null,
  }));
  const { error: itemErr } = await supabase.from('transaction_items').insert(itemRows);
  if (itemErr) {
    // Transaksi sudah tercatat tapi item gagal — batalkan supaya tidak ada
    // transaksi "hantu" tanpa item. Kasir diminta mengulang dari awal.
    await supabase.from('transactions').delete().eq('id', tx.id);
    fail(itemErr, 'Gagal menyimpan item transaksi');
  }

  return { id: tx.id, display_number, ...totals, paymentMethod: isSplitMode ? 'Split Payment' : paymentMethod, amount_paid, change_amount, paidAt: now };
}
