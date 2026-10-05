# Migrasi data dari app lama (mamam-global) ke C

Skrip: `scripts/migrasi-dari-a.mjs`. Dijalankan di laptop, dari folder `mamam-darurat`
(yang punya `.env.local`). Tidak ada kunci yang perlu dikirim ke mana pun: skrip membaca
`VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari `.env.local` milik C.

## Langkah

1. Di app lama: menu **Backup & Restore → Export Data (JSON)**, biarkan rentang tanggal kosong (**semua**). Pindahkan file
   `mamam-ayam-backup-data-semua.json` ke laptop. Ambil dari **HP yang datanya paling lengkap** (biasanya HP kasir utama): data app lama
   tersimpan di perangkatnya dan sinkronnya tidak bisa diandalkan.
2. **Simulasi dulu** (tidak menulis apa pun, hanya menampilkan laporan):
   ```powershell
   node scripts/migrasi-dari-a.mjs "C:\path\mamam-ayam-backup-data-semua.json"
   ```
3. Kalau laporannya masuk akal, tulis beneran:
   ```powershell
   node scripts/migrasi-dari-a.mjs "C:\path\mamam-ayam-backup-data-semua.json" --apply
   ```
4. Mau riwayat lama juga (transaksi, pengeluaran, pemasukan lain, riwayat shift):
   ```powershell
   node scripts/migrasi-dari-a.mjs "C:\path\mamam-ayam-backup-data-semua.json" --riwayat --apply
   ```

Boleh dijalankan berulang. Yang sudah ada di C dilewati, tidak ditimpa, tidak digandakan.

## Yang dipindah

| Dari app lama | Ke C | Catatan |
|---|---|---|
| Kategori menu, menu | Kategori, Menu | Urutan dipertahankan. HPP 0 jadi "belum diisi". |
| Grup varian, opsi, koneksi menu-varian | Varian | Kategori varian diturunkan dari grup. |
| Pelanggan | Pelanggan | Yang sudah dihapus dilewati. **Poin tidak ikut.** |
| Voucher | Voucher | Yang sudah dihapus atau jenisnya tidak dikenal dilewati. |
| Karyawan | Karyawan | Id lama disimpan sebagai `external_id` (dipakai untuk mencocokkan absensi). |
| *(--riwayat)* Transaksi + item | Transaksi | Yang dibatalkan (ada di tempat sampah) dilewati. |
| *(--riwayat)* Pengeluaran, pemasukan lain | Pengeluaran | Waktu dicatat diambil dari id lama, supaya tidak mengganggu Dompet yang sedang terbuka. |
| *(--riwayat)* Riwayat shift | Shift | Angka yang sudah dibekukan terbawa apa adanya. |

## Yang TIDAK dipindah (sengaja)

- Poin pelanggan (C belum punya poin; datanya tetap di app lama / mamam-point).
- Data gaji lama: kasbon, tambahan, potongan, saldo awal bulan. Catatan "Kasbon Karyawan" di Pengeluaran juga dilewati.
- Shift yang masih terbuka di app lama. Tutup dulu di app lama, ekspor ulang, baru buka Dompet di C.
- Bahan baku, HPP library, stok, setoran kurir, keranjang tersimpan, pengaturan toko.

## Hal yang perlu diketahui

- Transaksi lama tidak menyimpan uang diterima dan kembalian, jadi dua kolom itu kosong. Kode voucher per transaksi juga tidak tersimpan.
- Potongan poin pada transaksi lama digabung ke "diskon manual" supaya rincian tetap cocok dengan total.
- Pemasukan lain ikut dipindah, tapi layar Pengeluaran di C hanya menampilkan pengeluaran. Angkanya tetap dipakai hitungan Dompet.
- Lakukan migrasi riwayat **sebelum** membuka Dompet baru di C, atau pastikan backup diambil sebelum Dompet C dibuka. Kalau tidak, skrip memperingatkan.

## Membatalkan

Setiap penulisan dicatat di `migrasi-log-<tanggal>.json` (di folder tempat skrip dijalankan). Simpan file itu.

```powershell
node scripts/migrasi-dari-a.mjs --batalkan migrasi-log-20261004-153015.json          # lihat dulu
node scripts/migrasi-dari-a.mjs --batalkan migrasi-log-20261004-153015.json --apply  # hapus
```

Hanya baris yang ditulis skrip yang dihapus. Data yang lu buat sendiri di C tidak disentuh.
Kalau ada baris yang sudah dipakai data lain (mis. karyawan yang sudah punya data gaji), baris itu gagal dihapus dan dilaporkan.

## Pengaman

- Bawaan = simulasi. Menulis hanya dengan `--apply`.
- Hanya menyentuh project C. Menolak kalau `VITE_SUPABASE_URL` sama dengan database absensi.
- Menolak kunci rahasia (`service_role` / `sb_secret_…`).
- Kunci dan alamat lengkap tidak pernah dicetak.
