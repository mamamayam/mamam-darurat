/**
 * transform.mjs — mengubah file backup JSON mamam-global (app A) menjadi baris
 * siap-simpan untuk tabel-tabel C (mamam-darurat). FUNGSI MURNI: tanpa jaringan,
 * tanpa file, tanpa efek samping. Bisa dites tanpa database.
 *
 * Prinsip:
 *  1. AMAN DIULANG. Setiap data lama diberi id yang dihitung dari id lamanya
 *     (UUID v5), jadi menjalankan ulang tidak membuat data ganda.
 *  2. TIDAK MENIMPA. Kalau datanya sudah ada di C (id yang sama, atau nama/kode/
 *     nomor HP yang sama), data C dipakai apa adanya dan tidak diubah.
 *  3. TIDAK MENEBAK. Data yang tidak bisa dipindah dengan benar DILEWATI dan
 *     dicatat alasannya di laporan, bukan dipaksa masuk.
 *
 * Dua tahap:
 *  - master (selalu): kategori, menu, varian, pelanggan, voucher, karyawan
 *  - riwayat (opsional, withHistory): transaksi, pengeluaran, pemasukan lain, shift
 */
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Id deterministik
// ---------------------------------------------------------------------------

// JANGAN diubah: kalau berubah, menjalankan ulang akan membuat data ganda.
export const NAMESPACE = 'b3f1a7c2-5d4e-4a8b-9c6d-0e1f2a3b4c5d';

export function uuid5In(namespace, name) {
  const ns = Buffer.from(String(namespace).replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(ns).update(Buffer.from(String(name), 'utf8')).digest();
  h[6] = (h[6] & 0x0f) | 0x50;   // versi 5
  h[8] = (h[8] & 0x3f) | 0x80;   // varian RFC 4122
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
export const uuid5 = (name) => uuid5In(NAMESPACE, name);

// ---------------------------------------------------------------------------
// Pembantu kecil
// ---------------------------------------------------------------------------

const arr = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const text = (v) => { const s = String(v ?? '').trim(); return s || null; };
const finite = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const int = (v, d = 0) => { const n = finite(v); return n === null ? d : Math.round(n); };
const intMin0 = (v, d = 0) => Math.max(0, int(v, d));
const toDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateOrNull = (v) => { const s = String(v ?? '').slice(0, 10); return DATE_RE.test(s) ? s : null; };
const phoneKey = (p) => { const d = String(p ?? '').replace(/\D/g, ''); return d.length >= 6 ? d : null; };

/** Tanggal kalender WIB (UTC+7) dari sebuah momen. A menyimpan tanggal pengeluaran sebagai tengah malam lokal. */
export const wibDate = (d) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

const ORDER_TYPES = ['Takeaway', 'Dine-in', 'Delivery', 'Ojol'];
const PAYMENT_METHODS = ['Tunai', 'QRIS', 'Transfer', 'Ojol', 'Split Payment'];
const STATUSES = ['aktif', 'freelance', 'cuti', 'resign'];
const ROLES = ['kasir', 'kurir'];
export const OVERTIME_DEFAULT = 5000;
export const MIGRATION_TAG = 'migrasi-dari-A';

/** Urutan penulisan ke database (induk dulu, anak kemudian). */
export const TABLE_ORDER = [
  'categories', 'menu_items', 'variant_categories', 'variant_groups', 'variant_options',
  'menu_item_variant_groups', 'customers', 'vouchers', 'employees',
  'expense_categories', 'transactions', 'transaction_items', 'expenses', 'shifts',
];

// ---------------------------------------------------------------------------
// Rencana migrasi
// ---------------------------------------------------------------------------

/**
 * @param {object} backup    isi file backup JSON dari A ({ menus: [...], ... })
 * @param {object} existing  isi C saat ini (per tabel, hanya kolom yang dibutuhkan)
 * @param {{withHistory?: boolean}} opts
 */
export function buildPlan(backup, existing = {}, { withHistory = false } = {}) {
  if (!isObj(backup)) {
    throw new Error('File ini bukan backup JSON mamam-global. Pakai file hasil menu Backup → Export JSON (isinya harus berupa objek { "menus": [...], ... }).');
  }
  const ex = {
    categories: [], menu_items: [], variant_categories: [], variant_groups: [], variant_options: [],
    menu_item_variant_groups: [], customers: [], vouchers: [], employees: [], expense_categories: [],
    transactions: [], expenses: [], shifts: [],
    ...existing,
  };

  const out = {};
  const stats = {};
  const skipped = [];
  const notes = [];
  const read = {};
  const add = (table, row) => { (out[table] ||= []).push(row); bump(table, 'baru'); };
  const bump = (table, kind) => { (stats[table] ||= { baru: 0, sudahAda: 0 })[kind] += 1; };
  const skip = (section, label, reason) => skipped.push({ section, label: String(label ?? '(tanpa nama)'), reason });
  const note = (msg) => notes.push(msg);

  // =========================================================================
  // KATEGORI MENU
  // =========================================================================
  const menusRaw = arr(backup.menus);
  read.menus = menusRaw.length;
  read.categories = arr(backup.categories).length;

  const exCatById = new Map(ex.categories.map((c) => [c.id, c]));
  const exCatByName = new Map();
  for (const c of ex.categories) if (!exCatByName.has(norm(c.name))) exCatByName.set(norm(c.name), c);

  const catNames = [];
  const seenCat = new Set();
  const pushCat = (n) => { const t = text(n); if (t && !seenCat.has(norm(t))) { seenCat.add(norm(t)); catNames.push(t); } };
  arr(backup.categories).forEach(pushCat);
  for (const m of menusRaw) if (isObj(m) && !m.deletedAt && text(m.name)) pushCat(text(m.category) || 'Lainnya');

  const catIdByName = new Map();   // norm(nama) -> id di C
  catNames.forEach((name, i) => {
    const detId = uuid5(`category:${norm(name)}`);
    const found = exCatById.get(detId) || exCatByName.get(norm(name));
    if (found) { catIdByName.set(norm(name), found.id); bump('categories', 'sudahAda'); return; }
    catIdByName.set(norm(name), detId);
    add('categories', { id: detId, name, sort_order: i });
  });

  // =========================================================================
  // KATEGORI VARIAN, GRUP VARIAN, OPSI
  // =========================================================================
  const groupsRaw = arr(backup.variantGroups);
  read.variantGroups = groupsRaw.length;

  const exVcById = new Map(ex.variant_categories.map((c) => [c.id, c]));
  const exVcByName = new Map();
  for (const c of ex.variant_categories) if (!exVcByName.has(norm(c.name))) exVcByName.set(norm(c.name), c);

  // Di A, kategori varian tidak disimpan sendiri; ia diturunkan dari grup (urutan kemunculan pertama).
  const vcNames = [];
  const seenVc = new Set();
  for (const g of groupsRaw) {
    if (!isObj(g) || !text(g.name)) continue;
    const n = text(g.category) || 'Lainnya';
    if (!seenVc.has(norm(n))) { seenVc.add(norm(n)); vcNames.push(n); }
  }
  const vcIdByName = new Map();
  vcNames.forEach((name, i) => {
    const detId = uuid5(`variantcat:${norm(name)}`);
    const found = exVcById.get(detId) || exVcByName.get(norm(name));
    if (found) { vcIdByName.set(norm(name), found.id); bump('variant_categories', 'sudahAda'); return; }
    vcIdByName.set(norm(name), detId);
    add('variant_categories', { id: detId, name, sort_order: i });
  });

  const exVgById = new Map(ex.variant_groups.map((g) => [g.id, g]));
  const exVgByKey = new Map();
  for (const g of ex.variant_groups) {
    const k = `${g.category_id ?? ''}|${norm(g.name)}`;
    if (!exVgByKey.has(k)) exVgByKey.set(k, g);
  }
  const exVoById = new Map(ex.variant_options.map((o) => [o.id, o]));
  const exVoByKey = new Map();
  for (const o of ex.variant_options) {
    const k = `${o.variant_group_id}|${norm(o.name)}`;
    if (!exVoByKey.has(k)) exVoByKey.set(k, o);
  }

  const groupIdMap = new Map();    // id grup di A -> id di C
  const optionIdMap = new Map();   // id opsi di A -> id di C
  const seenGroup = new Set();
  groupsRaw.forEach((g, gi) => {
    if (!isObj(g)) { skip('Varian', '(baris rusak)', 'bukan data varian'); return; }
    const name = text(g.name);
    if (!name) { skip('Varian', '(tanpa nama)', 'nama grup varian kosong'); return; }
    if (g.deletedAt) { skip('Varian', name, 'sudah dihapus di app lama'); return; }
    const aid = text(g.id);
    if (aid && seenGroup.has(aid)) { skip('Varian', name, 'id ganda di file backup'); return; }
    if (aid) seenGroup.add(aid);

    const catName = text(g.category) || 'Lainnya';
    const catId = vcIdByName.get(norm(catName));
    const detId = uuid5(`variantgroup:${aid ?? `${norm(catName)}|${norm(name)}`}`);
    const found = exVgById.get(detId) || exVgByKey.get(`${catId}|${norm(name)}`);
    let groupId;
    if (found) { groupId = found.id; bump('variant_groups', 'sudahAda'); }
    else {
      groupId = detId;
      add('variant_groups', {
        id: groupId, category_id: catId, name, sort_order: gi,
        is_required: Boolean(g.isRequired), max_selection: Math.max(1, int(g.maxSelection, 1)),
      });
    }
    if (aid) groupIdMap.set(aid, groupId);

    arr(g.options).forEach((o, oi) => {
      if (!isObj(o)) return;
      const oname = text(o.name);
      if (!oname) { skip('Varian', `${name} › (opsi tanpa nama)`, 'nama opsi kosong'); return; }
      const oaid = text(o.id);
      const odetId = uuid5(`variantoption:${oaid ?? `${aid ?? name}#${oi}`}`);
      const ofound = exVoById.get(odetId) || exVoByKey.get(`${groupId}|${norm(oname)}`);
      let optId;
      if (ofound) { optId = ofound.id; bump('variant_options', 'sudahAda'); }
      else {
        optId = odetId;
        add('variant_options', { id: optId, variant_group_id: groupId, name: oname, extra_price: int(o.extraPrice, 0), sort_order: oi });
      }
      if (oaid) optionIdMap.set(oaid, optId);
    });
  });

  // =========================================================================
  // MENU
  // =========================================================================
  const exMenuById = new Map(ex.menu_items.map((m) => [m.id, m]));
  const exMenuByKey = new Map();
  for (const m of ex.menu_items) {
    const k = `${m.category_id}|${norm(m.name)}`;
    if (!exMenuByKey.has(k)) exMenuByKey.set(k, m);
  }
  const exLinks = new Set(ex.menu_item_variant_groups.map((l) => `${l.menu_item_id}|${l.variant_group_id}`));

  const menuIdMap = new Map();     // id menu di A -> id di C
  const seenMenu = new Set();
  const perCat = new Map();
  const newLinks = new Set();
  for (const m of menusRaw) {
    if (!isObj(m)) { skip('Menu', '(baris rusak)', 'bukan data menu'); continue; }
    const name = text(m.name);
    if (!name) { skip('Menu', '(tanpa nama)', 'nama menu kosong'); continue; }
    if (m.deletedAt) { skip('Menu', name, 'sudah dihapus di app lama'); continue; }
    const aid = text(m.id);
    if (aid && seenMenu.has(aid)) { skip('Menu', name, 'id ganda di file backup'); continue; }
    if (aid) seenMenu.add(aid);
    const price = finite(m.price);
    if (price === null || price < 0) { skip('Menu', name, 'harga tidak valid'); continue; }

    const catName = text(m.category) || 'Lainnya';
    const catId = catIdByName.get(norm(catName));
    const sortOrder = perCat.get(catId) ?? 0;
    perCat.set(catId, sortOrder + 1);

    const detId = uuid5(`menu:${aid ?? `${norm(catName)}|${norm(name)}`}`);
    const found = exMenuById.get(detId) || exMenuByKey.get(`${catId}|${norm(name)}`);
    let menuId;
    if (found) { menuId = found.id; bump('menu_items', 'sudahAda'); }
    else {
      menuId = detId;
      const hpp = finite(m.hpp);
      add('menu_items', {
        id: menuId, category_id: catId, name, price: Math.round(price),
        hpp: hpp !== null && hpp > 0 ? Math.round(hpp) : null,
        unit: 'porsi', sort_order: sortOrder,
      });
    }
    if (aid) menuIdMap.set(aid, menuId);

    for (const gid of arr(m.variantGroupIds)) {
      const cGroup = groupIdMap.get(String(gid));
      if (!cGroup) { skip('Menu', `${name} → varian`, `terhubung ke grup varian yang tidak ada (${gid})`); continue; }
      const key = `${menuId}|${cGroup}`;
      if (exLinks.has(key)) { bump('menu_item_variant_groups', 'sudahAda'); continue; }
      if (newLinks.has(key)) continue;
      newLinks.add(key);
      add('menu_item_variant_groups', { menu_item_id: menuId, variant_group_id: cGroup });
    }
  }

  // =========================================================================
  // PELANGGAN
  // =========================================================================
  const custRaw = arr(backup.customers);
  read.customers = custRaw.length;
  const exCustById = new Map(ex.customers.map((c) => [c.id, c]));
  const exCustByPhone = new Map();
  const exCustByNameNoPhone = new Map();
  for (const c of ex.customers) {
    const pk = phoneKey(c.phone);
    if (pk) { if (!exCustByPhone.has(pk)) exCustByPhone.set(pk, c); }
    else if (!exCustByNameNoPhone.has(norm(c.name))) exCustByNameNoPhone.set(norm(c.name), c);
  }
  const customerIdMap = new Map();
  const seenCust = new Set();
  let pointsTotal = 0;
  for (const c of custRaw) {
    if (!isObj(c)) { skip('Pelanggan', '(baris rusak)', 'bukan data pelanggan'); continue; }
    const name = text(c.name);
    if (!name) { skip('Pelanggan', '(tanpa nama)', 'nama kosong'); continue; }
    if (c.deletedAt) { skip('Pelanggan', name, 'sudah dihapus di app lama'); continue; }
    const aid = text(c.id);
    if (aid && seenCust.has(aid)) { skip('Pelanggan', name, 'id ganda di file backup'); continue; }
    if (aid) seenCust.add(aid);
    pointsTotal += Math.max(0, int(c.points, 0));

    const phone = text(c.phone);
    const pk = phoneKey(phone);
    const detId = uuid5(`customer:${aid ?? `${norm(name)}|${pk ?? ''}`}`);
    const found = exCustById.get(detId) || (pk ? exCustByPhone.get(pk) : exCustByNameNoPhone.get(norm(name)));
    if (found) { if (aid) customerIdMap.set(aid, found.id); bump('customers', 'sudahAda'); continue; }
    if (aid) customerIdMap.set(aid, detId);
    add('customers', { id: detId, name, phone });
  }
  if (pointsTotal > 0) {
    note(`Poin pelanggan (total ${pointsTotal} poin) TIDAK ikut dipindah: C belum punya poin. Datanya tetap ada di app lama / mamam-point.`);
  }

  // =========================================================================
  // VOUCHER
  // =========================================================================
  const vouRaw = arr(backup.vouchers);
  read.vouchers = vouRaw.length;
  const exVouById = new Map(ex.vouchers.map((v) => [v.id, v]));
  const exVouByCode = new Map(ex.vouchers.map((v) => [String(v.code ?? '').trim().toUpperCase(), v]));
  const seenCode = new Set();
  for (const v of vouRaw) {
    if (!isObj(v)) { skip('Voucher', '(baris rusak)', 'bukan data voucher'); continue; }
    const code = String(v.code ?? '').trim().toUpperCase();
    if (!code) { skip('Voucher', '(tanpa kode)', 'kode kosong'); continue; }
    if (v.deletedAt) { skip('Voucher', code, 'sudah dihapus di app lama'); continue; }
    if (seenCode.has(code)) { skip('Voucher', code, 'kode ganda di file backup'); continue; }
    seenCode.add(code);
    const type = v.discountType;
    if (type !== 'percent' && type !== 'fixed') { skip('Voucher', code, `jenis diskon tidak dikenal (${v.discountType})`); continue; }
    const value = int(v.discountValue, 0);
    if (value <= 0) { skip('Voucher', code, 'nilai diskon kosong/nol'); continue; }
    if (type === 'percent' && value > 100) { skip('Voucher', code, 'diskon persen lebih dari 100'); continue; }
    const detId = uuid5(`voucher:${code}`);
    if (exVouById.has(detId) || exVouByCode.has(code)) { bump('vouchers', 'sudahAda'); continue; }
    add('vouchers', { id: detId, code, discount_type: type, discount_value: value, min_purchase: intMin0(v.minPurchase, 0) });
  }

  // =========================================================================
  // KARYAWAN (mengikuti aturan impor karyawan yang sudah ada di C: src/features/employee/backupImport.js)
  // =========================================================================
  const empRaw = arr(backup.employees);
  read.employees = empRaw.length;
  const exEmpByExt = new Map(ex.employees.filter((e) => e.external_id).map((e) => [e.external_id, e]));
  const exEmpById = new Map(ex.employees.map((e) => [e.id, e]));
  const exEmpByNameNoExt = new Map();
  for (const e of ex.employees) if (!e.external_id && !exEmpByNameNoExt.has(norm(e.name))) exEmpByNameNoExt.set(norm(e.name), e);

  const empIdMap = new Map();     // id karyawan di A -> id di C
  const empNameMap = new Map();   // id karyawan di A -> nama
  const seenEmp = new Set();
  for (const e of empRaw) {
    if (!isObj(e)) { skip('Karyawan', '(baris rusak)', 'bukan data karyawan'); continue; }
    const name = text(e.name);
    if (!name) { skip('Karyawan', '(tanpa nama)', 'nama kosong'); continue; }
    const aid = text(e.id);
    if (aid) empNameMap.set(aid, name);
    if (e.deletedAt) { skip('Karyawan', name, 'sudah dihapus di app lama'); continue; }
    if (aid && seenEmp.has(aid)) { skip('Karyawan', name, 'id ganda di file backup'); continue; }
    if (aid) seenEmp.add(aid);

    const detId = uuid5(`employee:${aid ?? `nama:${norm(name)}`}`);
    const found = exEmpById.get(detId) || (aid ? exEmpByExt.get(aid) : exEmpByNameNoExt.get(norm(name)));
    if (found) { if (aid) empIdMap.set(aid, found.id); bump('employees', 'sudahAda'); continue; }

    const status = STATUSES.includes(e.status) ? e.status : 'aktif';
    const roleRaw = String(e.role ?? '').toLowerCase();
    const posNum = (v) => { const n = finite(v); return n !== null && n > 0 ? Math.round(n) : 0; };
    if (aid) empIdMap.set(aid, detId);
    add('employees', {
      id: detId, external_id: aid, name,
      phone: text(e.phone), address: text(e.address),
      role: ROLES.includes(roleRaw) ? roleRaw : 'kasir', status,
      wage_per_hour: posNum(e.hourlyRate), bonus_full_time: posNum(e.fullTimeBonus),
      overtime_rate_per_30_min: posNum(e.overtimeRate30) || OVERTIME_DEFAULT,
      start_date: dateOrNull(e.startDate),
      resign_date: status === 'resign' ? dateOrNull(e.resignDate) : null,
    });
  }
  if (empRaw.length > 0) {
    note('Data gaji lama (kasbon, tambahan, potongan, saldo awal bulan) TIDAK ikut dipindah. Karyawannya ikut, gajinya mulai dihitung dari absensi.');
  }

  // =========================================================================
  // RIWAYAT (opsional)
  // =========================================================================
  if (withHistory) {
    // Pengeluaran/pemasukan: kategori harus ada di daftar kategori C.
    const exEcByName = new Map();
    for (const c of ex.expense_categories) if (!exEcByName.has(norm(c.name))) exEcByName.set(norm(c.name), c);
    let ecMaxSort = Math.max(-1, ...ex.expense_categories.map((c) => int(c.sort_order, 0)));
    const ecNew = new Map();
    const canonExpenseCategory = (name) => {
      const n = norm(name);
      const found = exEcByName.get(n) || ecNew.get(n);
      if (found) return found.name;
      ecMaxSort += 1;
      const row = { id: uuid5(`expensecategory:${n}`), name, sort_order: ecMaxSort };
      ecNew.set(n, row);
      add('expense_categories', row);
      return name;
    };

    // ---- Transaksi ------------------------------------------------------
    const salesRaw = arr(backup.salesHistory);
    read.salesHistory = salesRaw.length;
    const exTx = new Set(ex.transactions.map((t) => t.id));
    const seenOrder = new Set();
    let pointDiscountOrders = 0;
    let mismatch = 0;
    let coerced = 0;
    const menuFallback = (aid, name) => uuid5(`menu:${aid ?? `?|${norm(name)}`}`);

    for (const o of salesRaw) {
      if (!isObj(o)) { skip('Transaksi', '(baris rusak)', 'bukan data transaksi'); continue; }
      const aid = text(o.id);
      if (!aid) { skip('Transaksi', '(tanpa id)', 'id kosong'); continue; }
      if (o.deletedAt) { skip('Transaksi', aid, 'dibatalkan/dihapus di app lama (ada di tempat sampah)'); continue; }
      if (seenOrder.has(aid)) { skip('Transaksi', aid, 'id ganda di file backup'); continue; }
      seenOrder.add(aid);
      const when = toDate(o.date);
      if (!when) { skip('Transaksi', aid, 'tanggal tidak valid'); continue; }
      const total = finite(o.total);
      if (total === null || total < 0) { skip('Transaksi', aid, 'total tidak valid'); continue; }

      const txId = uuid5(`order:${aid}`);
      if (exTx.has(txId)) { bump('transactions', 'sudahAda'); continue; }

      const items = arr(o.items).filter(isObj);
      const subtotal = finite(o.subtotal) ?? items.reduce((s, it) => s + int(it.price, 0) * int(it.qty, 0), 0);

      let orderType = o.orderType;
      if (!ORDER_TYPES.includes(orderType)) { orderType = 'Takeaway'; coerced += 1; }
      let method = o.paymentMethod;
      if (!PAYMENT_METHODS.includes(method)) { method = null; coerced += 1; }

      const pointDiscount = intMin0(o.pointDiscount, 0);
      if (pointDiscount > 0) pointDiscountOrders += 1;
      const manualAmount = intMin0(o.manualDiscountAmount, 0) + pointDiscount;   // poin tidak ada di C: digabung ke diskon manual
      const voucherDiscount = intMin0(o.discount, 0);
      const rounding = int(o.roundingAdjustment, 0);
      const expectedTotal = Math.round(subtotal) - voucherDiscount - manualAmount + int(o.taxAmount, 0) + int(o.serviceAmount, 0) + int(o.deliveryFee, 0) + rounding;
      if (expectedTotal !== Math.round(total)) mismatch += 1;

      const holder = cashHolderOf(o, empIdMap, empNameMap);
      const aCust = text(o.customerId);
      const split = arr(o.splitDetails).filter(isObj).map((p) => ({ method: p.method, amount: int(p.amount, 0) }));
      const iso = when.toISOString();

      add('transactions', {
        id: txId, display_number: aid, status: 'paid', order_type: orderType,
        customer_id: aCust ? (customerIdMap.get(aCust) ?? null) : null,
        customer_name: text(o.customerName),
        ojol_platform: method === 'Ojol' ? text(o.ojolName) : null,
        ojol_order_number: method === 'Ojol' ? text(o.orderNumber) : null,
        subtotal: Math.round(subtotal),
        voucher_id: null, voucher_code: null, voucher_discount: voucherDiscount,
        manual_discount_type: manualAmount > 0 ? 'fixed' : null,
        manual_discount_value: manualAmount > 0 ? manualAmount : null,
        manual_discount_amount: manualAmount,
        tax_amount: intMin0(o.taxAmount, 0), service_amount: intMin0(o.serviceAmount, 0),
        delivery_fee: intMin0(o.deliveryFee, 0), rounding_adjustment: rounding,
        total: Math.round(total), payment_method: method,
        amount_paid: null, change_amount: null,      // A tidak menyimpan uang diterima & kembalian
        split_payments_json: method === 'Split Payment' && split.length > 0 ? split : null,
        cash_holder_employee_id: holder.id, cash_holder_name: holder.name,
        created_at: iso, paid_at: iso,
      });

      items.forEach((it, idx) => {
        const iname = text(it.name) ?? 'Item';
        const aMenu = text(it.menuId);
        add('transaction_items', {
          id: uuid5(`txitem:${aid}:${idx}`), transaction_id: txId,
          menu_item_id: (aMenu && menuIdMap.get(aMenu)) || menuFallback(aMenu, iname),
          name: iname, variant_name: text(it.variantName),
          variant_selected_json: mapVariantSelection(it.variantSelectedOptions, groupIdMap, optionIdMap),
          price: int(it.price, 0), hpp: intMin0(it.hpp, 0), qty: Math.max(1, int(it.qty, 1)), note: text(it.note),
        });
      });
    }
    if (pointDiscountOrders > 0) note(`${pointDiscountOrders} transaksi memakai potongan poin. Karena C tidak punya poin, potongannya digabung ke "diskon manual" supaya rincian tetap cocok dengan total.`);
    if (mismatch > 0) note(`${mismatch} transaksi punya rincian angka yang tidak persis menjumlah ke total (biasanya data lama). Dipindah apa adanya; total tidak diubah.`);
    if (coerced > 0) note(`${coerced} isian transaksi (jenis pesanan/metode bayar) tidak dikenal dan dikosongkan/disamakan ke bawaan.`);
    note('Transaksi lama tidak menyimpan "uang diterima" dan "kembalian", jadi dua kolom itu kosong. Kode voucher per transaksi juga tidak tersimpan di app lama.');

    // ---- Pengeluaran & pemasukan lain ----------------------------------
    const exExp = new Set(ex.expenses.map((e) => e.id));
    let kasbonSkipped = 0;
    const seenExp = new Set();
    const buildLedger = (list, kind) => {
      const isExpense = kind === 'expense';
      const section = isExpense ? 'Pengeluaran' : 'Pemasukan lain';
      for (const e of arr(list)) {
        if (!isObj(e)) { skip(section, '(baris rusak)', 'bukan data'); continue; }
        const aid = text(e.id);
        const label = aid ?? '(tanpa id)';
        if (!aid) { skip(section, label, 'id kosong'); continue; }
        if (e.deletedAt) { skip(section, aid, 'dihapus di app lama (ada di tempat sampah)'); continue; }
        if (seenExp.has(`${kind}:${aid}`)) { skip(section, aid, 'id ganda di file backup'); continue; }
        seenExp.add(`${kind}:${aid}`);
        const category = text(e.category) ?? (isExpense ? 'Lainnya' : 'Pemasukan');
        if (isExpense && norm(category).includes('kasbon')) { kasbonSkipped += 1; skip(section, `${aid} (${category})`, 'kasbon karyawan: C mengurusnya di modul Karyawan, bukan pengeluaran biasa'); continue; }
        const amount = finite(e.amount);
        if (amount === null || amount <= 0) { skip(section, aid, 'nominal tidak valid'); continue; }
        const when = toDate(e.date);
        if (!when) { skip(section, aid, 'tanggal tidak valid'); continue; }

        const id = uuid5(`${kind}:${aid}`);
        if (exExp.has(id)) { bump('expenses', 'sudahAda'); continue; }

        // Waktu dicatat: id lama memuat jam sebenarnya (EXP-<ms> / INC-<ms>). Pakai itu supaya
        // Dompet/Shift di C tidak salah menghitung pengeluaran lama ke shift yang sedang terbuka.
        const m = /^(?:EXP|INC)-(\d{10,13})$/.exec(aid);
        let created = m ? new Date(Number(m[1])) : null;
        if (!created || Number.isNaN(created.getTime()) || created.getTime() < Date.UTC(2015, 0, 1)) {
          created = new Date(`${wibDate(when)}T12:00:00+07:00`);
        }
        const method = isExpense && e.paymentMethod === 'Non-Tunai' ? 'Non-Tunai' : 'Tunai';
        const holder = isExpense && method === 'Tunai' ? cashHolderOf(e, empIdMap, empNameMap) : { id: null, name: null };
        add('expenses', {
          id, direction: isExpense ? 'pengeluaran' : 'pemasukan',
          category: isExpense ? canonExpenseCategory(category) : category,
          amount: Math.round(amount), transaction_date: wibDate(when),
          store_or_supplier_name: null, detail: text(e.note) ?? text(e.description),
          payment_method: method,
          cash_holder_employee_id: holder.id, cash_holder_name: holder.name,
          created_at: created.toISOString(), created_by: MIGRATION_TAG,
        });
      }
    };
    read.expenses = arr(backup.expenses).length;
    read.incomes = arr(backup.incomes).length;
    buildLedger(backup.expenses, 'expense');
    buildLedger(backup.incomes, 'income');
    if (kasbonSkipped > 0) note(`${kasbonSkipped} catatan "Kasbon Karyawan" dilewati (kasbon akan diurus di modul Karyawan C).`);
    if (arr(backup.incomes).length > 0) note('Pemasukan lain ikut dipindah (jenis "pemasukan"). Layar Pengeluaran di C hanya menampilkan pengeluaran, tapi angkanya tetap dipakai hitungan Dompet.');

    // ---- Shift (riwayat) ------------------------------------------------
    const shiftsRaw = arr(backup.shiftHistory);
    read.shiftHistory = shiftsRaw.length;
    const exShift = new Set(ex.shifts.map((s) => s.id));
    const seenShift = new Set();
    for (const s of shiftsRaw) {
      if (!isObj(s)) { skip('Shift', '(baris rusak)', 'bukan data shift'); continue; }
      const aid = text(s.id);
      if (!aid) { skip('Shift', '(tanpa id)', 'id kosong'); continue; }
      if (s.deletedAt) { skip('Shift', aid, 'dihapus di app lama'); continue; }
      if (seenShift.has(aid)) { skip('Shift', aid, 'id ganda di file backup'); continue; }
      seenShift.add(aid);
      const start = toDate(s.startTime);
      const end = toDate(s.endTime);
      if (!start || !end || end.getTime() < start.getTime()) { skip('Shift', aid, 'jam buka/tutup tidak valid'); continue; }
      const id = uuid5(`shift:${aid}`);
      if (exShift.has(id)) { bump('shifts', 'sudahAda'); continue; }

      const st = isObj(s.stats) ? s.stats : {};
      const couriers = arr(s.courierBalancesSnapshot).filter(isObj).map((c) => ({
        employeeId: empIdMap.get(String(c.employeeId)) ?? text(c.employeeId),
        employeeName: text(c.employeeName) ?? 'Kurir', balance: int(c.balance, 0),
      }));
      const initial = int(st.initialCash ?? s.initialCash, 0);
      const expected = int(st.expectedCash, 0);
      const actual = finite(s.actualCash) === null ? null : int(s.actualCash);
      const diff = finite(s.difference) !== null ? int(s.difference) : (actual === null ? null : actual - expected);
      const known = ['initialCash', 'cashSales', 'cashIncomes', 'cashExpensesKasir', 'cashExpensesKurir', 'expectedCash', 'totalCashBisnis'];
      const statsJson = { ...st };
      for (const k of known) statsJson[k] = int(st[k], k === 'initialCash' ? initial : 0);
      statsJson.couriers = couriers;
      statsJson.totalHeldByCouriers = couriers.reduce((a, c) => a + c.balance, 0);
      if (finite(st.totalCashBisnis) === null) statsJson.totalCashBisnis = expected + statsJson.totalHeldByCouriers;

      const opener = text(s.openedByEmployeeId);
      add('shifts', {
        id, opening_balance: initial, closing_balance: actual,
        opened_at: start.toISOString(), closed_at: end.toISOString(), note: null,
        code: aid,
        opened_by_employee_id: opener ? (empIdMap.get(opener) ?? null) : null,
        opened_by_employee_name: text(s.openedByEmployeeName) ?? (opener ? empNameMap.get(opener) ?? null : null),
        expected_cash: expected, difference: diff, stats_json: statsJson, courier_snapshot_json: couriers,
      });
    }
    if (isObj(backup.currentShift)) note('Ada shift yang MASIH TERBUKA di app lama. Shift terbuka tidak dipindah: tutup dulu di app lama, ekspor ulang backup-nya, lalu buka Dompet baru di C.');
  }

  const inserts = TABLE_ORDER.filter((t) => (out[t] ?? []).length > 0).map((t) => ({ table: t, rows: out[t] }));
  return { inserts, stats, skipped, notes, read, withHistory };
}

// ---------------------------------------------------------------------------

function cashHolderOf(rec, empIdMap, empNameMap) {
  const h = isObj(rec.cashHolder) ? rec.cashHolder : null;
  let aid = null;
  let name = null;
  if (h && h.type === 'kurir') { aid = text(h.employeeId); name = text(h.employeeName); }
  else if (text(rec.courierId)) { aid = text(rec.courierId); }
  if (!aid && !name) return { id: null, name: null };
  return { id: (aid && empIdMap.get(aid)) || null, name: name ?? (aid ? empNameMap.get(aid) ?? null : null) };
}

/** { idGrupA: [idOpsiA] } -> { idGrupC: [idOpsiC] }, membuang daftar kosong. null kalau tidak ada. */
function mapVariantSelection(sel, groupIdMap, optionIdMap) {
  if (!isObj(sel)) return null;
  const out = {};
  for (const [g, opts] of Object.entries(sel)) {
    const list = arr(opts).map((o) => optionIdMap.get(String(o)) ?? String(o));
    if (list.length === 0) continue;
    out[groupIdMap.get(g) ?? g] = list;
  }
  return Object.keys(out).length > 0 ? out : null;
}
