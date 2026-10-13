/**
 * Rumus HPP (fungsi murni, dites). Tidak mengimpor apa pun dari POS.
 *
 * Aturan yang diikuti dari file "DATABASE MAMAM AYAM":
 *  - HPP baris resep = komposisi / pembelian * harga.
 *  - Total resep = jumlah HPP baris.
 *  - Baris dengan `ref` memakai TOTAL resep lain sebagai harganya (batch saos, tepung bumbu).
 *  - Harga online = harga outlet + 25%.
 *  - Margin = profit / harga jual outlet. HIGH jika margin >= 30%, selain itu LOW.
 *  - Harga disarankan (margin 30%) = HPP / 0,7.
 */
export const ONLINE_MARKUP = 1.25;
export const MARGIN_TARGET = 30;

/** Format rupiah bulat: 13622 -> "Rp13.622". */
export function rupiah(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  const v = Math.round(n);
  return `${v < 0 ? '-' : ''}Rp${Math.abs(v).toLocaleString('id-ID')}`;
}

/** Angka biasa dengan maksimal 1 desimal, koma Indonesia: 1410.5 -> "1.410,5". */
export function angka(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

/** HPP satu baris. Pembelian 0/kosong dianggap 0 supaya tidak jadi Infinity. */
export function rowHpp(komposisi, pembelian, harga) {
  if (!pembelian || !harga || !komposisi) return 0;
  return (komposisi / pembelian) * harga;
}

/**
 * Hitung semua resep. Mengembalikan peta id -> { id, nama, grup, batch, sheetTotal, total, selisih, rows }.
 * rows: { nama, komposisi, pembelian, harga, hpp, ref, refNama }.
 * `selisih` = total hitungan - total di file (null kalau file tidak menulis total).
 * Resep yang saling merujuk (siklus) dianggap harga 0 di titik putusnya, bukan loop tak hingga.
 */
export function computeRecipes(resep) {
  const byId = new Map(resep.map((r) => [r.id, r]));
  const done = new Map();
  const busy = new Set();

  const calc = (id) => {
    if (done.has(id)) return done.get(id);
    const r = byId.get(id);
    if (!r || busy.has(id)) return { total: 0 };
    busy.add(id);
    const rows = r.rows.map(([nama, komposisi, pembelian, harga, ref]) => {
      const refRes = ref ? calc(ref) : null;
      const hargaPakai = refRes ? refRes.total : harga;
      return {
        nama, komposisi, pembelian, harga: hargaPakai, hargaFile: harga,
        hpp: rowHpp(komposisi, pembelian, hargaPakai),
        ref: ref || null, refNama: ref && byId.get(ref) ? byId.get(ref).nama : null,
      };
    });
    const total = rows.reduce((s, x) => s + x.hpp, 0);
    const out = {
      id: r.id, nama: r.nama, grup: r.grup, batch: r.batch, sheetTotal: r.sheetTotal,
      total, selisih: r.sheetTotal === null ? null : total - r.sheetTotal, rows,
    };
    busy.delete(id);
    done.set(id, out);
    return out;
  };

  resep.forEach((r) => calc(r.id));
  return Object.fromEntries(done);
}

/** Turunan satu menu dari HPP dan harga outlet. */
export function menuMetrics(hpp, outlet) {
  const profit = outlet - hpp;
  const pct = outlet > 0 ? (profit / outlet) * 100 : 0;
  return {
    hpp, outlet,
    online: outlet * ONLINE_MARKUP,
    profit, pct,
    saran: hpp / (1 - MARGIN_TARGET / 100),
    kategori: pct >= MARGIN_TARGET ? 'HIGH' : 'LOW',
  };
}

/** Harga jual untuk target margin `margin` (%), dibulatkan ke atas ke kelipatan `step`. */
export function recommendPrice(hpp, margin, step = 500) {
  const m = Number(margin);
  if (!(hpp > 0) || !(m >= 0 && m < 100)) return 0;
  return Math.ceil(hpp / (1 - m / 100) / step) * step;
}

/** Bangun daftar menu lengkap dari baris data [kelompok, nama, hpp, outlet]. */
export function buildMenu(rows) {
  return rows.map(([kelompok, nama, hpp, outlet], i) => ({ id: i, kelompok, nama, ...menuMetrics(hpp, outlet) }));
}
