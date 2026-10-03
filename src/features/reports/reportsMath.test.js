import { describe, it, expect } from 'vitest';
import {
  summarizeSales, topMenus, computeProfitLoss, payrollCostFromResults, payrollCostByEmployee, isKasbon,
  periodRange, dayStartISO, nextDayStartISO, localDateOf, localDateString,
} from './reportsMath.js';

const it_ = (menu, name, qty, price, hpp) => ({ menu_item_id: menu, name, qty, price, hpp });
const sale = (total, pm, ot, items = []) => ({ total, payment_method: pm, order_type: ot, items });
const exp = (category, amount) => ({ category, amount });

describe('summarizeSales', () => {
  const sales = [
    sale(40000, 'Tunai', 'Takeaway', [it_('m1', 'Ayam Geprek', 2, 20000, 9000)]),
    sale(25000, 'QRIS', 'Dine-in', [it_('m1', 'Ayam Geprek', 1, 20000, 9000), it_('m2', 'Es Teh', 1, 5000, 1000)]),
    sale(30000, 'Tunai', 'Ojol', [it_('m3', 'Menu Baru', 3, 10000, 0)]),
  ];
  const s = summarizeSales(sales);
  it('total, jumlah, rata-rata', () => { expect(s.count).toBe(3); expect(s.total).toBe(95000); expect(s.average).toBe(31667); });
  it('HPP dari menu & laba kotor', () => {
    expect(s.hppTotal).toBe(2 * 9000 + 9000 + 1000 + 0);          // 28.000
    expect(s.grossProfit).toBe(95000 - 28000);
  });
  it('item terjual tanpa HPP terdeteksi (jumlah porsi)', () => { expect(s.itemsWithoutHppQty).toBe(3); });
  it('per metode bayar diurutkan dari terbesar', () => {
    expect(s.byPayment).toEqual([{ key: 'Tunai', count: 2, total: 70000 }, { key: 'QRIS', count: 1, total: 25000 }]);
  });
  it('per tipe order', () => { expect(s.byOrderType.map(x => x.key)).toEqual(['Takeaway', 'Ojol', 'Dine-in']); });
  it('kosong: semua nol, tanpa NaN', () => {
    const e = summarizeSales([]);
    expect(e).toMatchObject({ count: 0, total: 0, average: 0, hppTotal: 0, grossProfit: 0 });
  });
  it('transaksi tanpa items / angka teks aman', () => {
    const r = summarizeSales([{ total: '10000', payment_method: null, order_type: null }]);
    expect(r.total).toBe(10000); expect(r.byPayment[0].key).toBe('Lainnya');
  });
});

describe('topMenus', () => {
  it('dikelompokkan per menu, urut porsi terbanyak, dipotong limit', () => {
    const sales = [
      sale(0, 'Tunai', 'T', [it_('m1', 'Ayam', 2, 20000, 0), it_('m2', 'Es Teh', 5, 5000, 0)]),
      sale(0, 'Tunai', 'T', [it_('m1', 'Ayam', 4, 20000, 0)]),
    ];
    expect(topMenus(sales, 10)).toEqual([
      { key: 'm1', name: 'Ayam', qty: 6, revenue: 120000 },
      { key: 'm2', name: 'Es Teh', qty: 5, revenue: 25000 },
    ]);
    expect(topMenus(sales, 1)).toHaveLength(1);
  });
  it('menu yang sudah dihapus (id kosong) dikelompokkan per nama', () => {
    const r = topMenus([sale(0, 'T', 'T', [it_(null, 'Menu Lama', 1, 1000, 0), it_(null, 'Menu Lama', 2, 1000, 0)])]);
    expect(r).toEqual([{ key: 'nama:Menu Lama', name: 'Menu Lama', qty: 3, revenue: 3000 }]);
  });
});

describe('computeProfitLoss', () => {
  const sales = [
    sale(1000000, 'Tunai', 'Takeaway', [it_('m1', 'Ayam', 50, 20000, 9000)]),
    sale(500000, 'QRIS', 'Dine-in', [it_('m1', 'Ayam', 25, 20000, 9000)]),
  ];                                         // penghasilan 1.500.000 ; HPP menu = 75 x 9000 = 675.000
  const expenses = [exp('Belanja', 600000), exp('Listrik', 150000), exp('Sewa', 300000), exp('Gaji', 400000), exp('Kasbon Karyawan', 50000)];

  it('dasar BELANJA (seperti A): HPP = belanja bahan baku', () => {
    const r = computeProfitLoss({ sales, expenses, payrollCost: 500000, hppBasis: 'belanja' });
    expect(r).toMatchObject({ penghasilan: 1500000, hpp: 600000, labaKotor: 900000, biayaOperasional: 450000, biayaGaji: 500000, labaBersih: -50000 });
  });
  it('dasar MENU: HPP = jumlah HPP menu; belanja TIDAK dikurangkan lagi', () => {
    const r = computeProfitLoss({ sales, expenses, payrollCost: 500000, hppBasis: 'menu' });
    expect(r).toMatchObject({ hpp: 675000, labaKotor: 825000, biayaOperasional: 450000, labaBersih: 825000 - 450000 - 500000 });
    expect(r.belanjaBahanBaku).toBe(600000);          // tetap dilaporkan sebagai info
    expect(r.hppDifference).toBe(75000);              // menu - belanja
  });
  it('pengeluaran kategori GAJI tidak dihitung dobel dengan biaya gaji dari payroll', () => {
    const r = computeProfitLoss({ sales, expenses, payrollCost: 500000 });
    expect(r.biayaOperasional).toBe(450000);          // tanpa 400.000 "Gaji"
    expect(r.gajiExpenseIgnored).toBe(400000);
  });
  it('KASBON bukan biaya: tidak masuk operasional maupun HPP', () => {
    const r = computeProfitLoss({ sales, expenses, payrollCost: 0 });
    expect(r.kasbonExpenseIgnored).toBe(50000);
    expect(r.biayaOperasional).toBe(450000);
  });
  it('rincian operasional per kategori, terbesar dulu', () => {
    const r = computeProfitLoss({ sales, expenses, payrollCost: 0 });
    expect(r.operasionalByCategory).toEqual([{ category: 'Sewa', total: 300000 }, { category: 'Listrik', total: 150000 }]);
  });
  it('gaji BELUM bisa dihitung (null): ditandai, Laba Bersih tidak memasukkan gaji', () => {
    const r = computeProfitLoss({ sales, expenses, payrollCost: null });
    expect(r.gajiIncluded).toBe(false); expect(r.biayaGaji).toBe(0);
    expect(r.labaBersih).toBe(900000 - 450000);
  });
  it('payrollCost 0 (terhitung, memang nol) BERBEDA dari null (belum tersambung)', () => {
    expect(computeProfitLoss({ sales, expenses, payrollCost: 0 }).gajiIncluded).toBe(true);
  });
  it('item terjual tanpa HPP menu diberi peringatan', () => {
    const r = computeProfitLoss({ sales: [sale(10000, 'T', 'T', [it_('m9', 'Baru', 4, 2500, 0)])], expenses: [], payrollCost: 0, hppBasis: 'menu' });
    expect(r.itemsWithoutHppQty).toBe(4); expect(r.hpp).toBe(0);
  });
  it('kategori dicocokkan tanpa peduli huruf besar/kecil & spasi', () => {
    const r = computeProfitLoss({ sales: [], expenses: [exp(' belanja ', 100), exp('GAJI', 50), exp('KASBON', 10)], payrollCost: 0 });
    expect(r).toMatchObject({ belanjaBahanBaku: 100, gajiExpenseIgnored: 50, kasbonExpenseIgnored: 10, biayaOperasional: 0 });
  });
  it('kosong: semua nol', () => {
    expect(computeProfitLoss({ sales: [], expenses: [], payrollCost: 0 })).toMatchObject({ penghasilan: 0, hpp: 0, labaKotor: 0, labaBersih: 0 });
  });
});

describe('payrollCostFromResults (biaya gaji = upah kotor; kasbon bukan biaya)', () => {
  const r = (wage, ft, ot, add, deds) => ({ payroll: { attendance: { wagePay: wage, fullTimeBonusPay: ft, overtimePay: ot }, additionsTotal: add, deductions: deds } });
  it('upah + FT + lembur + tambahan', () => { expect(payrollCostFromResults([r(1000000, 100000, 50000, 25000, [])]).total).toBe(1175000); });
  it('potongan Kasbon TIDAK mengurangi biaya (piutang), potongan lain mengurangi', () => {
    const x = payrollCostFromResults([r(1000000, 0, 0, 0, [{ category: 'Kasbon', amount: 200000 }, { category: 'Denda', amount: 30000 }])]);
    expect(x.total).toBe(970000); expect(x.kasbonTotal).toBe(200000);
  });
  it('banyak karyawan dijumlah', () => { expect(payrollCostFromResults([r(1, 0, 0, 0, []), r(2, 0, 0, 0, [])]).total).toBe(3); });
  it('rincian per karyawan: terbesar dulu, yang nol dibuang, kasbon dilaporkan terpisah', () => {
    const mk = (id, name, wage, deds) => ({ employee: { id, name }, payroll: { attendance: { wagePay: wage, fullTimeBonusPay: 0, overtimePay: 0 }, additionsTotal: 0, deductions: deds } });
    const list = payrollCostByEmployee([mk('a', 'Andi', 500000, []), mk('b', 'Budi', 800000, [{ category: 'Kasbon', amount: 100000 }]), mk('c', 'Nol', 0, [])]);
    expect(list.map(x => x.name)).toEqual(['Budi', 'Andi']);
    expect(list[0]).toMatchObject({ gross: 800000, kasbon: 100000 });
  });
  it('isKasbon mengenali "Kasbon" dan "Kasbon Karyawan"', () => { expect(isKasbon('Kasbon')).toBe(true); expect(isKasbon('kasbon karyawan')).toBe(true); expect(isKasbon('Denda')).toBe(false); });
});

describe('periodRange & batas hari', () => {
  const today = '2026-09-30';
  it('hari ini / kemarin / bulan ini', () => {
    expect(periodRange('hari-ini', {}, today)).toEqual({ fromDate: '2026-09-30', toDate: '2026-09-30' });
    expect(periodRange('kemarin', {}, today)).toEqual({ fromDate: '2026-09-29', toDate: '2026-09-29' });
    expect(periodRange('bulan-ini', {}, today)).toEqual({ fromDate: '2026-09-01', toDate: '2026-09-30' });
  });
  it('kemarin melewati batas bulan & tahun', () => {
    expect(periodRange('kemarin', {}, '2026-10-01').fromDate).toBe('2026-09-30');
    expect(periodRange('kemarin', {}, '2027-01-01').fromDate).toBe('2026-12-31');
  });
  it('semua = tanpa batas; tanggal terpilih: tanpa akhir = satu hari', () => {
    expect(periodRange('semua')).toEqual({ fromDate: null, toDate: null });
    expect(periodRange('tanggal-terpilih', { start: '2026-09-05' })).toEqual({ fromDate: '2026-09-05', toDate: '2026-09-05' });
    expect(periodRange('tanggal-terpilih', { start: '2026-09-05', end: '2026-09-09' })).toEqual({ fromDate: '2026-09-05', toDate: '2026-09-09' });
    expect(periodRange('tanggal-terpilih', {})).toEqual({ fromDate: null, toDate: null });
  });
  it('batas hari: transaksi 23:59 masuk hari itu, 00:00 masuk hari berikutnya (waktu lokal)', () => {
    const start = Date.parse(dayStartISO('2026-09-30')), end = Date.parse(nextDayStartISO('2026-09-30'));
    const lastMinute = new Date(2026, 8, 30, 23, 59, 59).getTime(), midnight = new Date(2026, 9, 1, 0, 0, 0).getTime();
    expect(lastMinute >= start && lastMinute < end).toBe(true);
    expect(midnight >= start && midnight < end).toBe(false);
  });
  it('localDateOf memakai tanggal LOKAL, bukan UTC', () => {
    expect(localDateOf(new Date(2026, 8, 30, 0, 30).toISOString())).toBe('2026-09-30');
    expect(localDateOf(new Date(2026, 8, 30, 23, 30).toISOString())).toBe('2026-09-30');
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
