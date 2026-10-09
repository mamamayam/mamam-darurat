/**
 * listFilters — helper murni untuk layar daftar (Riwayat, Pengeluaran): label periode,
 * judul hari, dan pengelompokan per hari. FUNGSI MURNI (dites di listFilters.test.js).
 */

export const PERIOD_OPTIONS = [
  { key: 'hari-ini', label: 'Hari Ini' },
  { key: 'kemarin', label: 'Kemarin' },
  { key: 'bulan-ini', label: 'Bulan Ini' },
  { key: 'semua', label: 'Semua' },
  { key: 'tanggal-terpilih', label: 'Tanggal Terpilih' },
];

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// 'YYYY-MM-DD' dibaca sebagai tanggal LOKAL (bukan UTC) supaya tidak bergeser sehari.
const parseDay = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

/** '2026-10-10' -> '10 Okt' */
export const dayShort = (s) => { const d = parseDay(s); return `${d.getDate()} ${BULAN[d.getMonth()]}`; };

/** '2026-10-10' -> 'Sabtu, 10 Okt' */
export const dayHeading = (s) => { const d = parseDay(s); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`; };

/** Teks chip periode: nama pilihan, atau rentang tanggal untuk "Tanggal Terpilih". */
export function periodLabel(mode, custom = {}) {
  if (mode === 'tanggal-terpilih' && custom.start) {
    return custom.end && custom.end !== custom.start
      ? `${dayShort(custom.start)} – ${dayShort(custom.end)}`
      : dayShort(custom.start);
  }
  return (PERIOD_OPTIONS.find((p) => p.key === mode) || PERIOD_OPTIONS[0]).label;
}

/**
 * Kelompokkan daftar (yang SUDAH terurut) per hari tanpa mengubah urutan.
 * -> [{ day, items }]  (day = 'YYYY-MM-DD')
 */
export function groupByDay(list, dayOf) {
  const groups = [];
  const index = new Map();
  for (const item of list) {
    const day = dayOf(item);
    let g = index.get(day);
    if (!g) { g = { day, items: [] }; index.set(day, g); groups.push(g); }
    g.items.push(item);
  }
  return groups;
}

/** Jumlahkan nilai per hari -> Map(day -> total). */
export function sumByDay(list, dayOf, valueOf) {
  const map = new Map();
  for (const item of list) {
    const day = dayOf(item);
    map.set(day, (map.get(day) || 0) + (Number(valueOf(item)) || 0));
  }
  return map;
}
