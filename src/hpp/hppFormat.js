/** Format angka untuk halaman HPP (locale id-ID). Tanpa dependensi. */
export function rupiah(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  const v = Math.round(n);
  return `${v < 0 ? '-' : ''}Rp${Math.abs(v).toLocaleString('id-ID')}`;
}

/** Angka biasa, maksimal 2 desimal, koma Indonesia: 1410.5 -> "1.410,5". */
export function angka(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

export function persen(n, digit = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return `${n.toLocaleString('id-ID', { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** "2026-10-05T..." -> "5 Okt 2026". Tahun disembunyikan kalau sama dengan tahun `sekarang`. */
export function tanggal(iso, sekarang = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const base = `${d.getDate()} ${BULAN[d.getMonth()]}`;
  return d.getFullYear() === sekarang.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Ubah isian pengguna ("45.000", "45000", "45,5") jadi angka; null kalau tidak valid / negatif. */
export function parseAngka(teks) {
  const s = String(teks ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  const bersih = /,/.test(s) ? s.replace(/\./g, '').replace(',', '.') : (/^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s);
  const v = Number(bersih);
  return Number.isFinite(v) && v >= 0 ? v : null;
}
