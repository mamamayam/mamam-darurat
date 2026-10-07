import { describe, it, expect } from 'vitest';
import {
  summarizeSales, topMenus, summarizeExpenses, expenseDetailText,
  periodRange, dayStartISO, nextDayStartISO, localDateOf, localDateString,
} from './reportsMath.js';

const it_ = (menu, name, qty, price) => ({ menu_item_id: menu, name, qty, price });
const sale = (total, pm, ot, items = []) => ({ total, payment_method: pm, order_type: ot, items });
const exp = (category, amount) => ({ category, amount });

describe('summarizeSales', () => {
  const sales = [
    sale(40000, 'Tunai', 'Takeaway', [it_('m1', 'Ayam Geprek', 2, 20000)]),
    sale(25000, 'QRIS', 'Dine-in', [it_('m1', 'Ayam Geprek', 1, 20000), it_('m2', 'Es Teh', 1, 5000)]),
    sale(30000, 'Tunai', 'Ojol', [it_('m3', 'Menu Baru', 3, 10000)]),
  ];
  const s = summarizeSales(sales);
  it('total, jumlah, rata-rata', () => { expect(s.count).toBe(3); expect(s.total).toBe(95000); expect(s.average).toBe(31667); });
  it('tidak lagi membawa HPP / laba kotor (laba kotor = penjualan − pengeluaran, dihitung di tampilan)', () => {
    expect(s).not.toHaveProperty('hppTotal'); expect(s).not.toHaveProperty('grossProfit'); expect(s).not.toHaveProperty('itemsWithoutHppQty');
  });
  it('per metode bayar diurutkan dari terbesar', () => {
    expect(s.byPayment).toEqual([{ key: 'Tunai', count: 2, total: 70000 }, { key: 'QRIS', count: 1, total: 25000 }]);
  });
  it('per tipe order', () => { expect(s.byOrderType.map(x => x.key)).toEqual(['Takeaway', 'Ojol', 'Dine-in']); });
  it('kosong: semua nol, tanpa NaN', () => {
    const e = summarizeSales([]);
    expect(e).toMatchObject({ count: 0, total: 0, average: 0 });
  });
  it('transaksi tanpa items / angka teks aman', () => {
    const r = summarizeSales([{ total: '10000', payment_method: null, order_type: null }]);
    expect(r.total).toBe(10000); expect(r.byPayment[0].key).toBe('Lainnya');
  });
});

describe('topMenus', () => {
  it('dikelompokkan per menu, urut porsi terbanyak, dipotong limit', () => {
    const sales = [
      sale(0, 'Tunai', 'T', [it_('m1', 'Ayam', 2, 20000), it_('m2', 'Es Teh', 5, 5000)]),
      sale(0, 'Tunai', 'T', [it_('m1', 'Ayam', 4, 20000)]),
    ];
    expect(topMenus(sales, 10)).toEqual([
      { key: 'm1', name: 'Ayam', qty: 6, revenue: 120000 },
      { key: 'm2', name: 'Es Teh', qty: 5, revenue: 25000 },
    ]);
    expect(topMenus(sales, 1)).toHaveLength(1);
  });
  it('menu yang sudah dihapus (id kosong) dikelompokkan per nama', () => {
    const r = topMenus([sale(0, 'T', 'T', [it_(null, 'Menu Lama', 1, 1000), it_(null, 'Menu Lama', 2, 1000)])]);
    expect(r).toEqual([{ key: 'nama:Menu Lama', name: 'Menu Lama', qty: 3, revenue: 3000 }]);
  });
});

describe('summarizeExpenses (Pengeluaran = SEMUA kategori)', () => {
  const expenses = [exp('Belanja', 600000), exp('Bayar Ayam', 400000), exp('Kasbon', 50000), exp('Gaji', 300000), exp('Belanja', 100000)];
  const s = summarizeExpenses(expenses);
  it('total menjumlah semua kategori, tanpa ada yang dikecualikan (belanja, kasbon, gaji, dll)', () => {
    expect(s.total).toBe(1450000); expect(s.count).toBe(5);
  });
  it('Laba Kotor = penjualan − pengeluaran', () => {
    expect(2000000 - s.total).toBe(550000);
  });
  it('rincian per kategori: digabung, terbesar dulu, ada jumlah catatan', () => {
    expect(s.byCategory).toEqual([
      { category: 'Belanja', count: 2, total: 700000 },
      { category: 'Bayar Ayam', count: 1, total: 400000 },
      { category: 'Gaji', count: 1, total: 300000 },
      { category: 'Kasbon', count: 1, total: 50000 },
    ]);
  });
  it('kategori dicocokkan tanpa peduli huruf besar/kecil & spasi; kategori kosong = Lainnya', () => {
    const r = summarizeExpenses([exp(' belanja ', 100), exp('BELANJA', 50), exp('', 10), exp(null, 5)]);
    expect(r.byCategory).toEqual([{ category: 'belanja', count: 2, total: 150 }, { category: 'Lainnya', count: 2, total: 15 }]);
  });
  it('nominal teks / kosong aman; daftar kosong = nol', () => {
    expect(summarizeExpenses([exp('A', '2500'), exp('B', undefined)]).total).toBe(2500);
    expect(summarizeExpenses([])).toEqual({ count: 0, total: 0, byCategory: [] });
  });
});

describe('expenseDetailText', () => {
  it('toko/pemasok lalu catatan, poin per baris digabung " · "', () => {
    expect(expenseDetailText({ store_or_supplier_name: 'Pak Budi', detail: 'Ayam 20 ekor\n\n  Es batu  ' })).toBe('Pak Budi · Ayam 20 ekor · Es batu');
  });
  it('tanpa toko dan tanpa catatan = kosong', () => {
    expect(expenseDetailText({ store_or_supplier_name: null, detail: null })).toBe('');
    expect(expenseDetailText({})).toBe('');
  });
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
