/**
 * fetchAllPages — mengambil SEMUA baris dari query PostgREST yang dibatasi
 * 1000 baris per permintaan. `makeQuery(from, to)` harus mengembalikan
 * promise { data, error } untuk baris [from..to] dengan URUTAN DETERMINISTIK
 * (mis. order by waktu lalu id) — kalau urutan tidak stabil, baris bisa ganda
 * atau hilang di antara halaman.
 */
export const PAGE_SIZE = 1000;

export async function fetchAllPages(makeQuery, label = 'data') {
  const rows = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await makeQuery(start, start + PAGE_SIZE - 1);
    if (error) throw new Error(`Gagal memuat ${label}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    if (start > 500000) throw new Error(`Terlalu banyak ${label} untuk satu periode.`);
  }
  return rows;
}
