/**
 * reportsMath — rumus Laporan. FUNGSI MURNI (tanpa React/Supabase).
 *
 * Aturan Laporan (tab Laba Rugi):
 *    Laba Kotor = Total Penjualan − Total Pengeluaran
 *  - Total Penjualan  = transaksi lunas pada periode.
 *  - Total Pengeluaran = SEMUA catatan pengeluaran pada periode, apa pun kategori
 *    dan sumber dananya (tunai / non-tunai): belanja, bayar ayam, kasbon, gaji, dll.
 *    Tidak ada kategori yang dikecualikan, dan HPP menu tidak ikut dihitung.
 */

const num = (v) => Number(v) || 0;

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
  let total = 0;
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
  }
  const count = sales.length;
  const sortDesc = (m) => [...m.values()].sort((a, b) => b.total - a.total);
  return {
    count, total, average: count ? Math.round(total / count) : 0,
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

// ── Ringkasan pengeluaran ─────────────────────────────────────────────
/**
 * Total semua pengeluaran + rincian per kategori (terbesar dulu). Kategori
 * dicocokkan tanpa peduli huruf besar/kecil & spasi; kategori kosong = 'Lainnya'.
 */
export function summarizeExpenses(expenses) {
  let total = 0;
  const byCat = new Map();
  for (const e of expenses) {
    const amount = num(e.amount);
    total += amount;
    const name = String(e.category ?? '').trim() || 'Lainnya';
    const key = name.toLowerCase();
    const cur = byCat.get(key) || { category: name, count: 0, total: 0 };
    cur.count += 1; cur.total += amount; byCat.set(key, cur);
  }
  return { count: expenses.length, total, byCategory: [...byCat.values()].sort((a, b) => b.total - a.total) };
}

/**
 * Keterangan satu baris untuk daftar pengeluaran: toko/pemasok lalu catatan.
 * Catatan disimpan satu poin per baris, jadi digabung dengan " · ".
 */
export function expenseDetailText(e) {
  const lines = String(e.detail ?? '').split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  const supplier = String(e.store_or_supplier_name ?? '').trim();
  return [supplier, ...lines].filter(Boolean).join(' · ');
}
