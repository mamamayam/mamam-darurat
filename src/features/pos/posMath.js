/**
 * posMath — rumus harga keranjang POS. FUNGSI MURNI, sama seperti
 * shiftMath.js: tanpa React, tanpa Supabase, semua masukan eksplisit.
 *
 * Rumus di-port dari App.jsx mamam-global (getSubtotal/getDiscount/
 * getTaxableAmount/getTotal dkk), dengan pajak, service charge, dan poin
 * DIHAPUS (di luar scope gelombang 1 — lihat catatan keputusan).
 * Pembulatan turut dihapus karena hanya relevan bersama pengaturan toko
 * yang belum ada di C.
 *
 * Urutan tetap sama seperti A:
 *   subtotal → dikurangi voucher → dikurangi diskon manual → total
 */

const rp = (n) => Number(n) || 0;

export function cartSubtotal(cart) {
  return cart.reduce((sum, item) => sum + rp(item.price) * rp(item.qty), 0);
}

export function cartHppTotal(cart) {
  return cart.reduce((sum, item) => sum + rp(item.hpp) * rp(item.qty), 0);
}

/** Diskon dari voucher aktif. Tidak berlaku kalau subtotal < minPurchase. */
export function voucherDiscount(subtotal, voucher) {
  if (!voucher) return 0;
  if (subtotal < rp(voucher.min_purchase)) return 0;
  if (voucher.discount_type === 'percent') return Math.round(subtotal * (rp(voucher.discount_value) / 100));
  return rp(voucher.discount_value);
}

/** Diskon manual: persen dari subtotal, atau nominal tetap. */
export function manualDiscountAmount(subtotal, manualDiscount) {
  if (!manualDiscount || !manualDiscount.value) return 0;
  if (manualDiscount.type === 'percent') return Math.round((subtotal * rp(manualDiscount.value)) / 100);
  return rp(manualDiscount.value);
}

/**
 * Hitung total lengkap satu order dari cart + input checkout.
 * Semua angka non-negatif (Math.max 0) sama seperti A, supaya diskon
 * gabungan tidak pernah membuat total minus.
 */
export function computeOrderTotals({ cart, voucher, manualDiscount, orderType, deliveryFee }) {
  const subtotal = cartSubtotal(cart);
  const vDiscount = voucherDiscount(subtotal, voucher);
  const mDiscount = manualDiscountAmount(subtotal, manualDiscount);
  const taxable = Math.max(0, subtotal - vDiscount - mDiscount);
  const fee = orderType === 'Delivery' ? rp(deliveryFee) : 0;
  const total = Math.max(0, taxable + fee);
  return {
    subtotal,
    voucherDiscount: vDiscount,
    manualDiscountAmount: mDiscount,
    deliveryFee: fee,
    total,
    hppTotal: cartHppTotal(cart),
  };
}

/** Kembalian pembayaran tunai tunggal (bukan split). */
export function cashChange(amountPaid, total) {
  return Math.max(0, rp(amountPaid) - rp(total));
}

/** Split payment: sisa yang masih harus dibayar / kembalian bila lebih. */
export function splitStatus(splitPayments, total) {
  const paid = (splitPayments || []).reduce((s, p) => s + rp(p.amount), 0);
  const remaining = rp(total) - paid;
  return {
    totalPaid: paid,
    remaining: Math.max(0, remaining),
    change: remaining < 0 ? -remaining : 0,
    isFullyPaid: remaining <= 0,
  };
}

/** Nomor tampilan transaksi pendek, mis. #A1B2C3D4 dari uuid. */
export function displayNumberFromId(uuid) {
  return String(uuid || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}
