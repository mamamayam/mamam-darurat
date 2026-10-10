# Panduan untuk agent — Mamam POS (repo: mamam-darurat)

Baca ini dulu sebelum mengubah apa pun. Berlaku untuk agent apa pun (Claude, Codex, Cursor, dll).
Pemilik repo: Mamam. Bahasa kerja: **Indonesia** (teks tampilan, komentar kode, pesan ke pemilik).

## Aplikasi ini

- **Mamam POS** (dulu "Mamam Darurat", repo tetap `mamam-darurat`): POS + admin untuk usaha F&B MamamAyam, dipangkas dari
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
- Patch lama yang sudah di-apply diarsipkan di `patches/`. Itu hanya catatan sejarah (isinya sudah ada di kode, sebagian sudah ditimpa
  patch berikutnya): jangan di-apply ulang dan jangan dijadikan acuan. Patch baru dari agent cukup diserahkan lewat chat; pemilik bebas
  menyimpannya di `patches/` atau menghapusnya.

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
- **Tambahan & Potongan HANYA dicatat lewat Catat Cepat** (satu tempat). Layar **Penggajian** bersih dari formulir Tambahan/Potongan: hanya menampilkan rincian (+ tombol hapus) dan saldo awal.
  Potongan juga bisa **diubah** dari Penggajian: tombol pensil membuka form Potongan Catat Cepat yang SAMA (`QuickAdjustmentSheet` prop `editing`; karyawan dan jenis dikunci).
  RPC `ubah_potongan` (migrasi `010_ubah_potongan.sql`) mengubah potongan + pengeluaran karyawannya dalam satu transaksi (nominal, tanggal, kategori, keterangan, sumber dana). Periode yang sudah ditutup tetap menolak.
  Semua Potongan jadi pengeluaran karyawan, jadi selalu masuk gaji, Laporan pengeluaran, dan Dompet (kalau Tunai).
- **Kasbon hanya lewat Potongan karyawan**: kategori yang berawalan "Kasbon" tidak ditawarkan di dropdown form Pengeluaran (toko), tapi pengeluaran karyawan hasil Potongan tetap tampil di daftar Pengeluaran
  (badge Karyawan) dan dihitung di Laporan dan Dompet.
- Staf tidak melihat nominal Tambah/Potongan (izin `karyawan.upah`), hanya nominal toko.

**Laporan Gaji** (`src/features/payroll/PayrollReport.jsx`; periode **Mingguan dan Bulanan** memakai tampilan yang SAMA, tanpa tab Ringkas/Detail): Gaji Bersih di atas, lalu bagian yang dibuka satu per satu:
**Total Pendapatan**, **Pengurangan** (Kasbon, Potongan), **Saldo Awal Bulan** (khusus bulanan), dan **Rincian Harian**. Judul bagian hanya nama + nilai (tanpa teks abu-abu rincian).
- **Rincian Harian** = tabel *Keterangan | Pemasukan (+) | Pengeluaran (-)* per tanggal, dengan jam masuk s/d pulang (dibaca dari log absensi; periode tertutup tidak membaca absensi, jadi jam tidak tampil).
  Tiap hari hadir: Upah Jam Kerja, Uang Lembur, Bonus Full Time; Kasbon/Potongan/Tambahan tampil di tanggalnya (Potongan: ubah/hapus; Tambahan: hapus).
  Upah dan lembur per hari hanyalah **pembagian dari total periode** (aturan B tidak berubah, pembulatan tetap per periode): jumlah harian SELALU sama dengan total (`allocateProportional`, `allocateBlocks` di `payrollReport.js`).
- **Saldo awal bulan** disimpan bertanda di `payroll_opening_balances.amount`: positif = karyawan berutang ke toko (mengurangi gaji), negatif = toko berutang / kurang bayar (menambah gaji). Formulir memakai **jenis eksplisit**
  (Toko berutang / Karyawan berutang) + nominal positif, tanpa tanda minus (`openingToForm` / `openingFromForm`); nominal tanpa jenis ditolak. Toko berutang tampil sebagai "Sisa Bulan Lalu (Kurang Bayar)" di **Pendapatan**;
  karyawan berutang tampil sebagai "Hutang Bulan Lalu (Karyawan)" di **Potongan**. Rumus engine tidak berubah: Gaji Bersih = Total Pendapatan - Total Potongan.
- Susunan data ada di `payrollReport.js` (dites) dan dipakai tampilan DAN slip PDF, jadi angkanya selalu sama; tidak ada hitungan gaji baru di sana.
- **Bagikan PDF**: `payslipPdf.js` membuat slip di perangkat (tanpa library tambahan; format: judul, info 2 kolom, tabel harian opsional, Pendapatan > Total Pendapatan > Potongan > Total Potongan > Gaji Bersih, tanda tangan),
  dibagikan lewat menu share HP (`src/lib/shareFile.js`; tanpa menu share = diunduh). "Hari Kerja Masuk" ditulis `hadir/jumlah hari periode` (mis. 25/31). Tarif dan posisi diambil dari karyawan (periode tertutup: tarif beku di `rates_json`).
