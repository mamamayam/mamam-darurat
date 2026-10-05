import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildPlan, uuid5, uuid5In, wibDate, TABLE_ORDER, MIGRATION_TAG } from './transform.mjs';
import { makeBackup } from './fixture.mjs';

const rowsOf = (plan, table) => plan.inserts.find((g) => g.table === table)?.rows ?? [];
const one = (plan, table, pred) => rowsOf(plan, table).find(pred);

/** Ubah hasil rencana menjadi "isi C" (seolah sudah ditulis), untuk menguji jalan ulang. */
function asExisting(plan) {
  const ex = {};
  for (const g of plan.inserts) ex[g.table] = g.rows.map((r) => ({ ...r }));
  return ex;
}

describe('uuid5', () => {
  it('cocok dengan vektor uji resmi RFC 4122 (namespace DNS, "python.org")', () => {
    expect(uuid5In('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'python.org')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });
  it('deterministik, berbeda untuk nama berbeda, berbentuk uuid v5', () => {
    expect(uuid5('menu:m1')).toBe(uuid5('menu:m1'));
    expect(uuid5('menu:m1')).not.toBe(uuid5('menu:m2'));
    expect(uuid5('menu:m1')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('id untuk data lama TIDAK BOLEH berubah antar versi skrip (kalau berubah, menjalankan ulang menggandakan data)', () => {
    expect(uuid5('menu:m1')).toBe('61f9c1d3-d1c6-51b8-b385-db586a99639b');
    expect(uuid5('category:ayam geprek')).toBe('941240c8-a047-5f41-b471-c8e9e402f03e');
  });
  it('wibDate: tengah malam WIB yang tersimpan sebagai UTC kemarin sore tetap jatuh di tanggal WIB yang benar', () => {
    expect(wibDate(new Date('2026-10-02T17:00:00.000Z'))).toBe('2026-10-03');
    expect(wibDate(new Date('2026-10-03T16:59:59.999Z'))).toBe('2026-10-03');
    expect(wibDate(new Date('2026-10-03T17:00:00.000Z'))).toBe('2026-10-04');
  });
});

describe('master data', () => {
  const plan = buildPlan(makeBackup(), {});

  it('menolak file yang bukan backup (array, null, teks)', () => {
    for (const bad of [[], null, 'x', 5]) expect(() => buildPlan(bad, {})).toThrow(/bukan backup/i);
  });

  it('kategori menu: urutan dari daftar A, ditambah kategori yang hanya muncul di menu ("Lainnya" untuk menu tanpa kategori)', () => {
    const cats = rowsOf(plan, 'categories');
    expect(cats.map((c) => c.name)).toEqual(['Ayam Geprek', 'Minuman', 'Snack', 'Lainnya']);
    expect(cats.map((c) => c.sort_order)).toEqual([0, 1, 2, 3]);
  });

  it('menu: harga bulat, hpp 0 → null, unit porsi, urutan per kategori, terhubung ke kategori yang benar', () => {
    const menus = rowsOf(plan, 'menu_items');
    expect(menus.map((m) => m.name)).toEqual(['Ayam Geprek', 'Ayam Bakar', 'Es Teh', 'Kentang Goreng', 'Menu Tanpa Kategori']);
    const geprek = menus[0]; const bakar = menus[1];
    expect(geprek).toMatchObject({ price: 18000, hpp: 9000, unit: 'porsi', sort_order: 0 });
    expect(bakar.sort_order).toBe(1);
    expect(menus.find((m) => m.name === 'Kentang Goreng').hpp).toBeNull();
    const catId = (n) => rowsOf(plan, 'categories').find((c) => c.name === n).id;
    expect(geprek.category_id).toBe(catId('Ayam Geprek'));
    expect(menus.find((m) => m.name === 'Menu Tanpa Kategori').category_id).toBe(catId('Lainnya'));
  });

  it('menu rusak dilewati dengan alasan jelas (nama kosong, harga bukan angka)', () => {
    const reasons = plan.skipped.filter((s) => s.section === 'Menu').map((s) => s.reason);
    expect(reasons).toEqual(expect.arrayContaining(['nama menu kosong', 'harga tidak valid']));
    expect(rowsOf(plan, 'menu_items').find((m) => m.name === 'Harga Rusak')).toBeUndefined();
  });

  it('kategori varian diturunkan dari grup (urutan kemunculan pertama); grup & opsi lengkap dengan urutan', () => {
    expect(rowsOf(plan, 'variant_categories').map((c) => [c.name, c.sort_order])).toEqual([['Rasa', 0], ['Tambahan', 1]]);
    const groups = rowsOf(plan, 'variant_groups');
    expect(groups.map((g) => g.name)).toEqual(['Level Pedas', 'Topping']);
    expect(groups[0]).toMatchObject({ is_required: true, max_selection: 1 });
    expect(groups[1]).toMatchObject({ is_required: false, max_selection: 2 });
    const opts = rowsOf(plan, 'variant_options');
    expect(opts.map((o) => [o.name, o.extra_price, o.sort_order])).toEqual([['Level 1', 0, 0], ['Level 3', 0, 1], ['Extra Keju', 3000, 0], ['Telur Dadar', 4000, 1]]);
    expect(opts.every((o) => groups.some((g) => g.id === o.variant_group_id))).toBe(true);
  });

  it('koneksi menu-varian: hanya yang valid; yang menunjuk grup yang tidak ada dilewati dan dilaporkan', () => {
    expect(rowsOf(plan, 'menu_item_variant_groups')).toHaveLength(3);
    expect(plan.skipped.some((s) => s.section === 'Menu' && /vg-hilang/.test(s.reason))).toBe(true);
  });

  it('pelanggan: yang sudah dihapus dilewati; nomor HP kosong → null; poin dicatat sebagai TIDAK ikut', () => {
    const c = rowsOf(plan, 'customers');
    expect(c.map((r) => [r.name, r.phone])).toEqual([['Budi', '081298765432'], ['Sari', null]]);
    expect(plan.notes.some((n) => /Poin pelanggan.*15 poin/.test(n))).toBe(true);
    expect(c.every((r) => !('points' in r))).toBe(true);
  });

  it('voucher: kode huruf besar, jenis valid saja; dihapus/aneh dilewati', () => {
    const v = rowsOf(plan, 'vouchers');
    expect(v.map((r) => [r.code, r.discount_type, r.discount_value, r.min_purchase])).toEqual([['HEMAT10', 'percent', 10, 30000], ['POTONG5K', 'fixed', 5000, 0]]);
    expect(plan.skipped.filter((s) => s.section === 'Voucher').map((s) => s.label).sort()).toEqual(['ANEH', 'LAMA']);
  });

  it('karyawan: id lama → external_id; bonus "" → 0; lembur 0 → 5000; resign_date hanya untuk resign', () => {
    const e = rowsOf(plan, 'employees');
    expect(e[0]).toMatchObject({ external_id: 'EMP-1', name: 'Siti Aminah', role: 'kasir', status: 'aktif', wage_per_hour: 8000, bonus_full_time: 50000, overtime_rate_per_30_min: 5000, start_date: '2025-03-01', resign_date: null });
    expect(e[1]).toMatchObject({ external_id: 'EMP-2', role: 'kurir', status: 'resign', bonus_full_time: 0, overtime_rate_per_30_min: 5000, resign_date: '2026-06-30', phone: null, address: null });
  });

  it('karyawan yang sudah dihapus di app lama (deletedAt) tidak dibawa', () => {
    const b = makeBackup();
    b.employees.push({ id: 'EMP-DEL', name: 'Sudah Dihapus', hourlyRate: 1000, deletedAt: '2026-09-01T00:00:00.000Z' });
    const p = buildPlan(b, {});
    expect(rowsOf(p, 'employees').map((e) => e.external_id)).toEqual(['EMP-1', 'EMP-2']);
    expect(p.skipped.some((x) => x.section === 'Karyawan' && x.label === 'Sudah Dihapus')).toBe(true);
  });

  it('tanpa --riwayat: tidak ada transaksi/pengeluaran/shift sama sekali', () => {
    for (const t of ['transactions', 'transaction_items', 'expenses', 'shifts', 'expense_categories']) expect(rowsOf(plan, t)).toEqual([]);
  });

  it('urutan penulisan: tabel induk sebelum anak', () => {
    const order = plan.inserts.map((g) => g.table);
    const idx = (t) => order.indexOf(t);
    expect(idx('categories')).toBeLessThan(idx('menu_items'));
    expect(idx('variant_categories')).toBeLessThan(idx('variant_groups'));
    expect(idx('variant_groups')).toBeLessThan(idx('variant_options'));
    expect(idx('menu_items')).toBeLessThan(idx('menu_item_variant_groups'));
    expect(idx('variant_groups')).toBeLessThan(idx('menu_item_variant_groups'));
    expect(order).toEqual(TABLE_ORDER.filter((t) => order.includes(t)));
  });
});

describe('aman diulang dan tidak menimpa', () => {
  it('menjalankan lagi setelah semuanya masuk: tidak ada baris baru sama sekali (master + riwayat)', () => {
    const first = buildPlan(makeBackup(), {}, { withHistory: true });
    const again = buildPlan(makeBackup(), asExisting(first), { withHistory: true });
    expect(again.inserts).toEqual([]);
    expect(again.stats.menu_items).toEqual({ baru: 0, sudahAda: 5 });
    expect(again.stats.transactions.sudahAda).toBe(4);
  });

  it('data C yang sudah ada dengan nama sama (beda huruf besar/kecil, id berbeda) DIPAKAI, bukan digandakan', () => {
    const existing = {
      categories: [{ id: 'c-existing', name: 'ayam  GEPREK' }],
      menu_items: [{ id: 'menu-existing', category_id: 'c-existing', name: 'ayam geprek' }],
      customers: [{ id: 'cust-existing', name: 'Budi Lain', phone: '0812-9876-5432' }],
      vouchers: [{ id: 'v-existing', code: 'Hemat10' }],
      employees: [{ id: 'emp-existing', external_id: 'EMP-2', name: 'Joko' }],
    };
    const p = buildPlan(makeBackup(), existing, { withHistory: true });
    expect(rowsOf(p, 'categories').map((c) => c.name)).toEqual(['Minuman', 'Snack', 'Lainnya']);
    expect(rowsOf(p, 'menu_items').map((m) => m.name)).not.toContain('Ayam Geprek');
    expect(rowsOf(p, 'customers').map((c) => c.name)).toEqual(['Sari']);
    expect(rowsOf(p, 'vouchers').map((v) => v.code)).toEqual(['POTONG5K']);
    expect(rowsOf(p, 'employees').map((e) => e.external_id)).toEqual(['EMP-1']);

    // rujukan ke data yang sudah ada diarahkan ke id MILIK C
    const link = rowsOf(p, 'menu_item_variant_groups').filter((l) => l.menu_item_id === 'menu-existing');
    expect(link).toHaveLength(2);
    const tx1 = one(p, 'transactions', (t) => t.display_number === 'ORD-AAAA0001');
    expect(tx1.customer_id).toBe('cust-existing');
    const item = one(p, 'transaction_items', (i) => i.transaction_id === tx1.id && i.name === 'Ayam Geprek');
    expect(item.menu_item_id).toBe('menu-existing');
    const tx2 = one(p, 'transactions', (t) => t.display_number === 'ORD-AAAA0002');
    expect(tx2.cash_holder_employee_id).toBe('emp-existing');
  });

  it('transaksi/pengeluaran/shift yang id-nya sudah ada di C dilewati', () => {
    const first = buildPlan(makeBackup(), {}, { withHistory: true });
    const partial = { transactions: [first.inserts.find((g) => g.table === 'transactions').rows[0]] };
    const p = buildPlan(makeBackup(), partial, { withHistory: true });
    expect(rowsOf(p, 'transactions')).toHaveLength(3);
    expect(p.stats.transactions.sudahAda).toBe(1);
    // item milik transaksi yang dilewati tidak ikut dimasukkan lagi
    const skippedTx = partial.transactions[0].id;
    expect(rowsOf(p, 'transaction_items').every((i) => i.transaction_id !== skippedTx)).toBe(true);
  });
});

describe('riwayat', () => {
  const plan = buildPlan(makeBackup(), {}, { withHistory: true });
  const tx = (n) => one(plan, 'transactions', (t) => t.display_number === n);

  it('hanya transaksi sah yang masuk: yang dibatalkan, id ganda, tanggal rusak dilewati', () => {
    expect(rowsOf(plan, 'transactions').map((t) => t.display_number)).toEqual(['ORD-AAAA0001', 'ORD-AAAA0002', 'ORD-AAAA0003', 'ORD-AAAA0004']);
    const r = plan.skipped.filter((s) => s.section === 'Transaksi').map((s) => s.reason).join('|');
    expect(r).toMatch(/dibatalkan/); expect(r).toMatch(/id ganda/); expect(r).toMatch(/tanggal tidak valid/);
  });

  it('transaksi tunai biasa: status paid, waktu bayar = waktu transaksi, uang diterima/kembalian kosong', () => {
    const t = tx('ORD-AAAA0001');
    expect(t).toMatchObject({ status: 'paid', order_type: 'Takeaway', customer_name: 'Budi', subtotal: 48000, total: 48000, payment_method: 'Tunai', amount_paid: null, change_amount: null, split_payments_json: null, cash_holder_employee_id: null });
    expect(t.created_at).toBe('2026-10-03T05:41:22.118Z'); expect(t.paid_at).toBe(t.created_at);
    expect(t.id).toBe(uuid5('order:ORD-AAAA0001'));
  });

  it('delivery COD ke kurir: kurir terhubung ke karyawan C; diskon poin digabung ke diskon manual dan rincian tetap menjumlah ke total', () => {
    const t = tx('ORD-AAAA0002');
    const joko = one(plan, 'employees', (e) => e.external_id === 'EMP-2');
    expect(t).toMatchObject({ order_type: 'Delivery', voucher_discount: 2000, manual_discount_type: 'fixed', manual_discount_value: 1000, manual_discount_amount: 1000, delivery_fee: 5000, total: 24000, cash_holder_employee_id: joko.id, cash_holder_name: 'Joko', customer_id: null });
    expect(t.subtotal - t.voucher_discount - t.manual_discount_amount + t.delivery_fee + t.rounding_adjustment).toBe(t.total);
    expect(plan.notes.some((n) => /potongan poin/.test(n))).toBe(true);
    expect(plan.notes.some((n) => /tidak persis menjumlah/.test(n))).toBe(false);
  });

  it('split payment tersimpan rinci; ojol menyimpan platform & nomor pesanan; pembulatan negatif dipertahankan', () => {
    expect(tx('ORD-AAAA0003').split_payments_json).toEqual([{ method: 'Tunai', amount: 10000 }, { method: 'QRIS', amount: 20000 }]);
    expect(tx('ORD-AAAA0003').customer_id).toBe(one(plan, 'customers', (c) => c.name === 'Sari').id);
    expect(tx('ORD-AAAA0004')).toMatchObject({ order_type: 'Ojol', payment_method: 'Ojol', ojol_platform: 'Gofood', ojol_order_number: 'GF-123', rounding_adjustment: -500, total: 17500 });
  });

  it('item: harga/hpp/qty/catatan terbawa; pilihan varian dipetakan ke id C dan daftar kosong dibuang', () => {
    const t1 = tx('ORD-AAAA0001');
    const gepr = one(plan, 'transaction_items', (i) => i.transaction_id === t1.id && i.name === 'Ayam Geprek');
    const vg1 = one(plan, 'variant_groups', (g) => g.name === 'Level Pedas').id;
    const vg2 = one(plan, 'variant_groups', (g) => g.name === 'Topping').id;
    const o12 = one(plan, 'variant_options', (o) => o.name === 'Level 3').id;
    const o21 = one(plan, 'variant_options', (o) => o.name === 'Extra Keju').id;
    expect(gepr).toMatchObject({ price: 21000, hpp: 9000, qty: 2, note: 'tanpa timun', variant_name: 'Level 3, Extra Keju' });
    expect(gepr.variant_selected_json).toEqual({ [vg1]: [o12], [vg2]: [o21] });
    expect(gepr.menu_item_id).toBe(one(plan, 'menu_items', (m) => m.name === 'Ayam Geprek').id);
    const t2 = tx('ORD-AAAA0002');
    const bakar = one(plan, 'transaction_items', (i) => i.transaction_id === t2.id);
    expect(bakar.variant_selected_json).toEqual({ [vg1]: [one(plan, 'variant_options', (o) => o.name === 'Level 1').id] });   // vg2 kosong dibuang
    const noVariant = one(plan, 'transaction_items', (i) => i.name === 'Es Teh');
    expect(noVariant.variant_selected_json).toBeNull(); expect(noVariant.variant_name).toBeNull(); expect(noVariant.note).toBeNull();
  });

  it('item dari menu yang sudah dihapus tetap masuk (tanpa relasi paksa); id-nya stabil', () => {
    const lama = one(plan, 'transaction_items', (i) => i.name === 'Menu Lama');
    expect(lama.menu_item_id).toBe(uuid5('menu:m-sudah-dihapus'));
    expect(lama.qty).toBe(2);
    expect(rowsOf(plan, 'menu_items').some((m) => m.id === lama.menu_item_id)).toBe(false);
  });

  it('pengeluaran: tanggal kalender WIB benar, waktu dicatat diambil dari id (bukan "sekarang")', () => {
    const e = one(plan, 'expenses', (x) => x.detail === 'Ayam 10kg');
    expect(e).toMatchObject({ direction: 'pengeluaran', category: 'Belanja', amount: 125000, transaction_date: '2026-10-03', payment_method: 'Tunai', created_by: MIGRATION_TAG });
    expect(e.created_at).toBe(new Date(1790990000000).toISOString());
    expect(new Date(e.created_at).getTime()).toBeLessThan(Date.now());
  });

  it('pengeluaran tanpa jam di id: dicatat tengah hari WIB pada tanggal itu; field "description" lama ikut terbaca', () => {
    const e = one(plan, 'expenses', (x) => x.detail === 'format lama');
    expect(e.transaction_date).toBe('2026-10-01');
    expect(e.created_at).toBe('2026-10-01T05:00:00.000Z');
  });

  it('kas dipegang kurir ikut terbawa untuk pengeluaran tunai; non-tunai tidak punya pemegang kas', () => {
    const gas = one(plan, 'expenses', (x) => x.detail === 'Gas');
    const joko = one(plan, 'employees', (e) => e.external_id === 'EMP-2');
    expect(gas).toMatchObject({ cash_holder_employee_id: joko.id, cash_holder_name: 'Joko' });
    const listrik = one(plan, 'expenses', (x) => x.detail === 'Transfer listrik');
    expect(listrik).toMatchObject({ payment_method: 'Non-Tunai', cash_holder_employee_id: null, cash_holder_name: null });
  });

  it('kasbon karyawan TIDAK dipindah sebagai pengeluaran; yang dihapus & nominal nol juga dilewati', () => {
    expect(rowsOf(plan, 'expenses').some((x) => x.amount === 100000)).toBe(false);
    const reasons = plan.skipped.filter((s) => s.section === 'Pengeluaran').map((s) => s.reason).join('|');
    expect(reasons).toMatch(/kasbon/); expect(reasons).toMatch(/dihapus/); expect(reasons).toMatch(/nominal tidak valid/);
  });

  it('pemasukan lain masuk sebagai direction "pemasukan"; kategori pengeluaran baru dibuat hanya untuk pengeluaran', () => {
    const inc = one(plan, 'expenses', (x) => x.direction === 'pemasukan');
    expect(inc).toMatchObject({ amount: 500000, category: 'Modal Tambahan', detail: 'Tambah modal', transaction_date: '2026-10-03' });
    expect(inc.created_at).toBe(new Date(1790990400000).toISOString());
    expect(rowsOf(plan, 'expense_categories').map((c) => c.name).sort()).toEqual(['Belanja', 'Lain-lain', 'biaya']);
  });

  it('kategori pengeluaran yang sudah ada di C dipakai dengan penulisan C (tidak membuat yang baru)', () => {
    const p = buildPlan(makeBackup(), { expense_categories: [{ id: 'k1', name: 'Biaya', sort_order: 0 }, { id: 'k2', name: 'Belanja', sort_order: 1 }] }, { withHistory: true });
    expect(one(p, 'expenses', (x) => x.detail === 'Gas').category).toBe('Biaya');
    expect(rowsOf(p, 'expense_categories').map((c) => c.name)).toEqual(['Lain-lain']);
    expect(rowsOf(p, 'expense_categories')[0].sort_order).toBe(2);
  });

  it('shift lama: angka dibekukan terbawa; snapshot kurir memakai id karyawan C; shift terbuka TIDAK dipindah', () => {
    const s = rowsOf(plan, 'shifts');
    expect(s).toHaveLength(1);
    const joko = one(plan, 'employees', (e) => e.external_id === 'EMP-2');
    const siti = one(plan, 'employees', (e) => e.external_id === 'EMP-1');
    expect(s[0]).toMatchObject({ code: 'DOMPET-5D02E3F1', opening_balance: 200000, closing_balance: 920000, expected_cash: 925000, difference: -5000, opened_by_employee_id: siti.id, opened_by_employee_name: 'Siti Aminah', opened_at: '2026-10-02T01:00:00.000Z', closed_at: '2026-10-02T14:30:00.000Z' });
    expect(s[0].courier_snapshot_json).toEqual([{ employeeId: joko.id, employeeName: 'Joko', balance: 24000 }]);
    expect(s[0].stats_json).toMatchObject({ initialCash: 200000, cashSales: 850000, expectedCash: 925000, totalHeldByCouriers: 24000, couriers: s[0].courier_snapshot_json });
    expect(rowsOf(plan, 'shifts').every((r) => r.closed_at)).toBe(true);
    expect(plan.notes.some((n) => /MASIH TERBUKA/.test(n))).toBe(true);
  });

  it('tidak ada catatan "masih terbuka" kalau di app lama tidak ada shift terbuka', () => {
    const b = makeBackup(); b.currentShift = null;
    expect(buildPlan(b, {}, { withHistory: true }).notes.some((n) => /MASIH TERBUKA/.test(n))).toBe(false);
  });

  it('peringatan kalau rincian transaksi tidak menjumlah ke total (data lama), tapi total tidak diubah', () => {
    const b = makeBackup(); b.salesHistory[0].total = 47000;
    const p = buildPlan(b, {}, { withHistory: true });
    expect(p.notes.some((n) => /1 transaksi punya rincian/.test(n))).toBe(true);
    expect(one(p, 'transactions', (t) => t.display_number === 'ORD-AAAA0001').total).toBe(47000);
  });

  it('jenis pesanan/metode bayar yang tidak dikenal tidak menjatuhkan database: disamakan ke bawaan dan dicatat', () => {
    const b = makeBackup(); b.salesHistory[0].orderType = 'Drive-thru'; b.salesHistory[0].paymentMethod = 'Kripto';
    const p = buildPlan(b, {}, { withHistory: true });
    const t = one(p, 'transactions', (x) => x.display_number === 'ORD-AAAA0001');
    expect(t.order_type).toBe('Takeaway'); expect(t.payment_method).toBeNull();
    expect(p.notes.some((n) => /tidak dikenal/.test(n))).toBe(true);
  });

  it('backup rentang tanggal (kunci tertentu hilang) tidak membuat error', () => {
    const b = { salesHistory: makeBackup().salesHistory, expenses: [] };
    const p = buildPlan(b, {}, { withHistory: true });
    expect(rowsOf(p, 'transactions')).toHaveLength(4);
    expect(rowsOf(p, 'menu_items')).toEqual([]);
  });
});

describe('kecocokan dengan schema C (mencegah drift)', () => {
  const sql = fs.readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
  const columns = {};
  for (const m of sql.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)) {
    columns[m[1]] = new Set(m[2].split('\n').map((l) => /^\s{2}([a-z0-9_]+)\s+[a-z]/.exec(l)?.[1]).filter((c) => c && !['primary', 'unique', 'check', 'constraint', 'foreign'].includes(c)));
  }
  it('setiap kolom yang ditulis skrip memang ada di tabelnya', () => {
    const plan = buildPlan(makeBackup(), {}, { withHistory: true });
    for (const g of plan.inserts) {
      expect(columns[g.table], `tabel ${g.table} tidak ditemukan di schema.sql`).toBeTruthy();
      for (const row of g.rows) for (const k of Object.keys(row)) expect(columns[g.table].has(k), `${g.table}.${k} tidak ada di schema.sql`).toBe(true);
    }
  });
  it('setiap kolom NOT NULL tanpa default selalu terisi', () => {
    const required = {
      categories: ['name'], menu_items: ['category_id', 'name', 'price'], variant_categories: ['name'], variant_groups: ['name'],
      variant_options: ['variant_group_id', 'name'], customers: ['name'], vouchers: ['code', 'discount_type', 'discount_value'],
      employees: ['name'], expense_categories: ['name'], transactions: ['display_number', 'status', 'order_type', 'subtotal', 'total'],
      transaction_items: ['transaction_id', 'menu_item_id', 'name', 'price', 'qty'], expenses: ['category', 'amount'], shifts: [],
    };
    const plan = buildPlan(makeBackup(), {}, { withHistory: true });
    for (const g of plan.inserts) for (const row of g.rows) for (const c of required[g.table] ?? []) expect(row[c], `${g.table}.${c}`).not.toBeNull();
  });
});
