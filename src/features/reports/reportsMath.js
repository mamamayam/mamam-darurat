/**
 * reportsMath — rumus Laporan & Laba Rugi. FUNGSI MURNI (tanpa React/Supabase).
 *
 * Sumber aturan: mamam-global.
 *  - Ringkasan  = ReportsView A (penjualan, HPP dari menu, laba kotor).
 *  - Laba Rugi  = modul Balance A (balance.js): Penghasilan − HPP − Biaya
 *    Operasional − Biaya Gaji; KASBON BUKAN BIAYA (piutang ke karyawan).
 *
 * BEDA dari A (sengaja):
 *  - Stok opname dilewati di C, jadi HPP berdasar belanja = belanja bahan baku
 *    saja (stok awal/akhir dianggap 0), atau HPP dari menu (pilihan).
 *  - Pengeluaran kategori "Gaji" TIDAK dihitung sebagai biaya operasional,
 *    karena Biaya Gaji diambil dari mesin payroll. Kalau dua-duanya dihitung,
 *    gaji terhitung dua kali.
 *  - Ringkasan tidak menampilkan "Laba Bersih". Di A, ringkasan mengurangi
 *    SEMUA pengeluaran dari laba kotor (HPP menu), sehingga belanja bahan baku
 *    terhitung dua kali (di HPP dan di pengeluaran).
 */

export const BAHAN_BAKU_CATEGORY = 'Belanja';
export const GAJI_CATEGORY = 'Gaji';

const num = (v) => Number(v) || 0;
const norm = (s) => String(s ?? '').trim().toLowerCase();
export const isKasbon = (category) => norm(category).startsWith('kasbon');
const isBahanBaku = (category) => norm(category) === norm(BAHAN_BAKU_CATEGORY);
const isGaji = (category) => norm(category) === norm(GAJI_CATEGORY);

// ── Periode (tanggal lokal) ───────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
export const localDateString = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDaysLocal = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateString(new Date(y, m - 1, d + n));
};

/**
 * Rentang tanggal inklusif dari pilihan filter. `semua` -> { fromDate:null, toDate:null }.
 * `tanggal-terpilih` tanpa tanggal akhir = satu hari (tanggal awal).
 */
export function periodRange(mode, custom = {}, today = localDateString()) {
  switch (mode) {
    case 'hari-ini': return { fromDate: today, toDate: today };
    case 'kemarin': { const y = addDaysLocal(today, -1); return { fromDate: y, toDate: y }; }
    case 'bulan-ini': return { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
    case 'tanggal-terpilih': {
      if (!custom.start) return { fromDate: null, toDate: null };
      return { fromDate: custom.start, toDate: custom.end || custom.start };
    }
    default: return { fromDate: null, toDate: null };
  }
}

/** Awal hari lokal (00:00) sebagai ISO UTC — untuk filter kolom timestamptz. */
export const dayStartISO = (dateStr) => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString(); };
/** Awal hari BERIKUTNYA — dipakai sebagai batas atas eksklusif (< ). */
export const nextDayStartISO = (dateStr) => dayStartISO(addDaysLocal(dateStr, 1));

/** Tanggal lokal 'YYYY-MM-DD' dari timestamp ISO. */
export const localDateOf = (iso) => localDateString(new Date(iso));

// ── Ringkasan penjualan ───────────────────────────────────────────────
const itemsOf = (sale) => (Array.isArray(sale.items) ? sale.items : []);

export function summarizeSales(sales) {
  let total = 0, hppTotal = 0, itemsWithoutHppQty = 0;
  const byPayment = new Map(), byOrderType = new Map();
  const add = (map, key, amount) => {
    const k = key || 'Lainnya';
    const cur = map.get(k) || { key: k, count: 0, total: 0 };
    cur.count += 1; cur.total += amount; map.set(k, cur);
  };
  for (const s of sales) {
    const t = num(s.total);
    total += t;
    add(byPayment, s.payment_method, t);
    add(byOrderType, s.order_type, t);
    for (const it of itemsOf(s)) {
      const q = num(it.qty);
      hppTotal += num(it.hpp) * q;
      if (num(it.hpp) === 0) itemsWithoutHppQty += q;
    }
  }
  const count = sales.length;
  const sortDesc = (m) => [...m.values()].sort((a, b) => b.total - a.total);
  return {
    count, total, average: count ? Math.round(total / count) : 0,
    hppTotal, grossProfit: total - hppTotal, itemsWithoutHppQty,
    byPayment: sortDesc(byPayment), byOrderType: sortDesc(byOrderType),
  };
}

/** Menu terlaris: dikelompokkan per menu_item_id (atau nama kalau id kosong). */
export function topMenus(sales, limit = 10) {
  const map = new Map();
  for (const s of sales) for (const it of itemsOf(s)) {
    const key = it.menu_item_id || `nama:${it.name}`;
    const cur = map.get(key) || { key, name: it.name, qty: 0, revenue: 0 };
    cur.qty += num(it.qty); cur.revenue += num(it.price) * num(it.qty);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, limit);
}

// ── Biaya gaji untuk Laba Rugi ────────────────────────────────────────
/**
 * Biaya gaji = upah kotor: upah + bonus full time + lembur + tambahan − potongan
 * NON-kasbon. Kasbon tidak mengurangi biaya (itu piutang ke karyawan, bukan biaya
 * usaha), dan saldo awal juga bukan biaya. Sama dengan A (getTotalBiayaGaji).
 * `results` = keluaran usePayrollData (satu per karyawan).
 */
export function employeeGrossCost(r) {
  const p = r.payroll, a = p.attendance;
  const potonganNonKasbon = p.deductions.filter(d => !isKasbon(d.category)).reduce((s, d) => s + num(d.amount), 0);
  const kasbon = p.deductions.filter(d => isKasbon(d.category)).reduce((s, d) => s + num(d.amount), 0);
  return { gross: a.wagePay + a.fullTimeBonusPay + a.overtimePay + p.additionsTotal - potonganNonKasbon, kasbon };
}

export function payrollCostFromResults(results) {
  let total = 0, kasbonTotal = 0;
  for (const r of results) { const c = employeeGrossCost(r); total += c.gross; kasbonTotal += c.kasbon; }
  return { total, kasbonTotal };
}

/** Rincian per karyawan untuk ditampilkan (terbesar dulu; yang Rp 0 dibuang). */
export function payrollCostByEmployee(results) {
  return results
    .map(r => ({ id: r.employee.id, name: r.employee.name, ...employeeGrossCost(r) }))
    .filter(x => x.gross !== 0)
    .sort((a, b) => b.gross - a.gross);
}

// ── Laba Rugi ─────────────────────────────────────────────────────────
/**
 * @param sales         penjualan lunas pada periode (dengan items)
 * @param expenses      pengeluaran pada periode (direction 'pengeluaran')
 * @param payrollCost   angka dari payrollCostFromResults().total, atau null kalau
 *                      gaji belum bisa dihitung (absensi belum tersambung / gagal)
 * @param hppBasis      'belanja' (seperti A, tanpa stok opname) | 'menu' (HPP manual per menu)
 */
export function computeProfitLoss({ sales, expenses, payrollCost, hppBasis = 'belanja' }) {
  const penghasilan = sales.reduce((s, x) => s + num(x.total), 0);

  let hppMenu = 0, itemsWithoutHppQty = 0;
  for (const s of sales) for (const it of itemsOf(s)) {
    hppMenu += num(it.hpp) * num(it.qty);
    if (num(it.hpp) === 0) itemsWithoutHppQty += num(it.qty);
  }

  let belanjaBahanBaku = 0, gajiExpenseIgnored = 0, kasbonExpenseIgnored = 0, biayaOperasional = 0;
  const byCat = new Map();
  for (const e of expenses) {
    const amt = num(e.amount);
    if (isKasbon(e.category)) { kasbonExpenseIgnored += amt; continue; }
    if (isBahanBaku(e.category)) { belanjaBahanBaku += amt; continue; }
    if (isGaji(e.category)) { gajiExpenseIgnored += amt; continue; }
    biayaOperasional += amt;
    byCat.set(e.category, (byCat.get(e.category) || 0) + amt);
  }
  const operasionalByCategory = [...byCat.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

  const hpp = hppBasis === 'menu' ? hppMenu : belanjaBahanBaku;
  const labaKotor = penghasilan - hpp;
  const gajiIncluded = payrollCost != null;
  const biayaGaji = gajiIncluded ? payrollCost : 0;
  const labaBersih = labaKotor - biayaOperasional - biayaGaji;

  return {
    hppBasis, penghasilan, hpp, hppMenu, belanjaBahanBaku, labaKotor,
    biayaOperasional, operasionalByCategory, biayaGaji, gajiIncluded, labaBersih,
    // Informasi / peringatan kualitas data
    itemsWithoutHppQty, gajiExpenseIgnored, kasbonExpenseIgnored,
    hppDifference: hppMenu - belanjaBahanBaku,
  };
}
