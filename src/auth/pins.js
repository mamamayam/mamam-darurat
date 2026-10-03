/**
 * PIN login — HARDCODED sesuai permintaan (tanpa auth sungguhan).
 *
 * PERHATIAN: ini PAGAR TAMPILAN, bukan pengaman data.
 *  - Isi file ini ikut terkirim ke browser, jadi siapa pun yang membuka file
 *    JavaScript aplikasi bisa membaca PIN-nya.
 *  - Database Supabase tetap terbuka untuk siapa pun yang punya URL + anon key
 *    (kebijakan RLS "anon boleh semua"), jadi PIN tidak melindungi data dari
 *    akses langsung ke API.
 *  Cukup untuk membatasi tampilan antar-karyawan di perangkat toko. Sebelum
 *  aplikasi dibuka ke internet umum, ganti dengan login sungguhan.
 *
 * Mengganti PIN: ubah dua nilai di bawah, lalu build ulang.
 */
export const PINS = {
  owner: '3678',
  staff: '0000',
};
