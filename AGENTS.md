# Panduan untuk agent — mamam-darurat

Baca ini dulu sebelum mengubah apa pun. Berlaku untuk agent apa pun (Claude, Codex, Cursor, dll).
Pemilik repo: Mamam. Bahasa kerja: **Indonesia** (teks tampilan, komentar kode, pesan ke pemilik).

## Aplikasi ini

- **Mamam Darurat ("Aplikasi C")**: POS + admin untuk usaha F&B MamamAyam, dipangkas dari
  `mamam-global`. Kasir, Dompet/Shift, Pelanggan, Pengeluaran, Karyawan, Absensi, Riwayat, Laporan, Penggajian, Menu.
- Stack: React 19 + Vite + Tailwind 4, Supabase (Postgres), PWA tulis tangan (`public/sw.js`, tanpa VitePWA). Dites dengan Vitest.
- **Online-first**: data langsung ke Supabase. Service worker hanya menyimpan cangkang app, **tidak pernah data**.
- Absensi dibaca (baca-saja) dari project Supabase terpisah; kunci ada di `.env.local` (lihat `.env.example`), jangan pernah menaruh kunci di repo atau chat.
- Skema database: `supabase/schema.sql` + `supabase/migrations/NNN_*.sql` (dijalankan manual di SQL Editor, aman diulang).

## Cara kerja dengan pemilik (PENTING)

- Pemilik **menerapkan perubahan sendiri**: agent menyerahkan file `.patch` dan perintah `git apply`; pemilik yang commit dan push.
  Agent biasanya **tidak punya akses push** ke repo ini. Jangan memaksa push; serahkan patch.
- Sebelum membuat patch, ambil `main` terbaru (`git fetch origin main`, rebase) karena pemilik sering push di sela-sela.
  Cek patch bisa di-apply bersih ke `origin/main` (`git apply --check`) dan tes + build lolos.
- Ambil keputusan yang masuk akal sendiri dan sebutkan asumsinya. Untuk perubahan tampilan, tunjukkan preview dulu bila memungkinkan.
- Setelah `git apply`, pemilik harus `git pull` sebelum push berikutnya, karena Action versi menambah commit di `main` (lihat bawah).

## Versi otomatis

Versi di `package.json` **dinaikkan otomatis** oleh GitHub Action tiap push ke `main`. **Jangan ubah `version` manual** dan jangan
membuat commit `chore(release): ...`. Besar-kecilnya ditentukan dari awalan pesan commit:

| Awalan pesan commit | Naik | Contoh |
|---|---|---|
| `feat!:` / `feat(x)!:` / baris `BREAKING CHANGE:` | major | 1.4.7 → 2.0.0 |
| `feat:` | minor | 1.4.7 → 1.5.0 |
| `fix:` `refactor:` `chore:` `docs:` `perf:` `test:` `style:` atau tanpa awalan | patch | 1.4.7 → 1.4.8 |

Agent **wajib** menulis pesan commit/patch dengan awalan ini, kalimat Indonesia setelah titik dua: `fix: kategori pengeluaran jadi dropdown`.
Rincian: `docs/versioning.md`. Versi tampil di menu Lainnya dan layar login (`src/lib/appVersion.js`).

## Aturan kode

- **Izin per peran** hanya di `src/auth/permissions.js` (peran: `owner`, `staff`). Izin tak terdaftar ditolak untuk semua. Layar terkunci lewat `VIEW_PERMISSION`;
  menu Lainnya otomatis menyembunyikan layar yang tak boleh dibuka. Ini pagar tampilan (PIN hardcoded di `pins.js`), bukan keamanan data.
- Uang = integer rupiah. Tanggal pengeluaran = string `YYYY-MM-DD` apa adanya (jangan di-parse sebagai UTC). Rumus murni ditaruh di berkas `*Math.js` / engine dan **dites**.
- Hapus = hard delete (tanpa recycle bin). Tampilan mengikuti pola komponen di `src/components/ui/` (Card, Select, Badge, SegmentedControl, dst).
- Setelah mengubah kode: `npm test` dan `npm run build` harus lolos. Tambah/ubah tes untuk logika yang berubah.
- **Folder `mamam-darurat/` di dalam repo adalah salinan lama (duplikat `src`)** yang ikut terbawa dan ikut dijalankan Vitest. Jangan jadikan acuan dan jangan
  diedit untuk fitur. Satu pengecualian: tes izin (`src/auth/auth.test.js`) membaca kode `src/` lalu mencocokkannya dengan daftar izin di salinan itu,
  jadi **kalau mengubah `permissions.js`, ubah juga `mamam-darurat/src/auth/permissions.js`** supaya tes tidak merah. Idealnya folder salinan itu dihapus
  (tanya pemilik dulu).

## Keputusan produk yang sudah ditetapkan pemilik

**Laporan** (`src/features/reports/`) punya dua tab dengan filter periode yang sama (Hari Ini, Kemarin, Bulan Ini, Semua, Tanggal Terpilih):
- **Laba Rugi**: Total Penjualan, Laba Kotor, Pengeluaran (3 kartu, tanpa HPP), lalu per metode bayar, per tipe pesanan, menu terlaris.
  **Laba Kotor = Total Penjualan − Pengeluaran.** Pengeluaran = SEMUA catatan pengeluaran apa pun kategorinya (belanja, bayar ayam, kasbon,
  gaji, dll; tunai dan non-tunai). Tidak ada kategori yang dikecualikan dan tidak ada "laba bersih" di sini.
- **Rincian Pengeluaran** (owner-only): total, per kategori, dan daftar semua catatan pengeluaran.

**Pengeluaran**: kolom Kategori adalah dropdown; kategori baru ditambah lewat ikon gerigi (Kelola Kategori).

**Staf** tidak boleh melihat/membuka **Riwayat** dan **Laporan** (owner-only).

**Gaji** mengikuti aturan hitung mamam-kasir (B): `docs/payroll-rules.md`. Jangan diubah diam-diam.

**Catat Cepat (Beranda)** (`src/features/home/`): menggantikan daftar "Riwayat Pesanan Hari Ini". Tile **Pengeluaran** (toko, di atas), lalu **Tambah** dan **Potongan** (karyawan), dua kartu ringkasan
(**Pengeluaran Karyawan** dan **Pengeluaran Toko**), pengajuan menunggu (owner), dan catatan hari ini.
- Form-nya **komponen yang sama** dengan modul asli: Pengeluaran = `ExpenseFormSheet` (juga dipakai layar Pengeluaran); Tambah/Potongan = `AdjustmentFields` (juga dipakai Penggajian).
  Jangan menduplikasi form; ubah komponen bersama.
- **Persetujuan owner HANYA untuk Tambah** dari staf (`payroll_additions.status`: `menunggu`/`disetujui`/`ditolak`, izin `tambahan.setujui`). Tambah yang belum disetujui **tidak dihitung gaji**
  dan menahan penutupan periode gaji. Potongan dan Pengeluaran **langsung dicatat**, tanpa persetujuan.
- **Potongan = pengeluaran karyawan**: RPC `catat_potongan` (migrasi `009_catat_cepat.sql`) menulis `expenses` (dengan `employee_id`) + `payroll_deductions` dalam satu transaksi.
  Sumber dana Tunai otomatis mengurangi saldo Dompet (rumus Dompet tidak diubah: hanya `payment_method = 'Tunai'`). Menghapus pengeluaran karyawan ikut menghapus potongannya (FK cascade), begitu juga sebaliknya lewat `usePayrollData.deleteDeduction`.
- Potongan yang dibuat dari layar **Penggajian** tetap hanya mencatat potongan gaji (tidak jadi pengeluaran, tidak menyentuh Dompet).
- Staf tidak melihat nominal Tambah/Potongan (izin `karyawan.upah`), hanya nominal toko.
