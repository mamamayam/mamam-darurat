# HPP (halaman `/hpp`)

Penghitung modal (HPP) menu: **bahan baku -> resep -> menu**. Tujuannya mudah mengganti harga bahan dan
langsung melihat menu mana yang modalnya berubah, tanpa membaca daftar panjang.

## Memasang (sekali)

Semua di Supabase Dashboard -> **SQL Editor** project C (project `mamam-kasir`).

1. Jalankan `supabase/migrations/013_hpp.sql` (tabel, trigger riwayat harga, RPC, RLS). Aman diulang.
2. Jalankan `supabase/migrations/014_hpp_data_awal.sql` (data awal dari file harga 27/11/2025). Aman diulang:
   memakai ID tetap dan `ON CONFLICT DO NOTHING`, jadi tidak menimpa harga yang sudah Anda ubah.
3. Daftarkan akun admin HPP. Pilih salah satu:
   - **Akun baru khusus HPP** (disarankan, password bisa kuat): Authentication -> Users -> Add user (centang
     Auto Confirm User).
   - **Akun owner POS yang sudah ada**: password-nya `mamam:` + PIN. Di layar login HPP cukup ketik PIN 4 digit.

   Lalu jalankan (ganti email):
   ```sql
   insert into hpp_admin (user_id)
   select id from auth.users where lower(email) = lower('EMAIL-AKUN@contoh.com')
   on conflict do nothing;
   ```
4. Buka `https://<domain>/hpp` (atau tombol **HPP** di menu Lainnya, khusus owner) dan masuk.

Variabel `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` sama dengan yang dipakai POS.

## Keamanan

- Tabel HPP **tidak** memakai tingkat "Longgar" seperti tabel POS. Role `anon` dicabut, dan role `authenticated`
  hanya boleh jika akunnya ada di `hpp_admin`. Akun staf POS yang sudah login tetap tidak bisa membaca HPP.
- `hpp_admin` tidak bisa dibaca lewat API; pemeriksaan lewat fungsi `hpp_is_admin()`.
- Riwayat harga (`hpp_harga_riwayat`) hanya ditambah oleh trigger saat harga bahan berubah. Tidak bisa diubah
  atau dihapus lewat API, seperti riwayat transaksi. Salah ketik diperbaiki dengan memasukkan harga yang benar.
- Tidak ada data HPP di file JavaScript aplikasi. Data hanya dimuat setelah login.

## Cara kerja hitungan

| Hal | Aturan |
|---|---|
| Harga per unit dasar bahan | `harga / isi` (isi = jumlah unit dasar dalam satu satuan beli, mis. 1 kg = 1000 gr) |
| Baris resep (bahan) | `qty x harga per unit dasar` |
| Baris resep (resep lain) | resep batch (punya `hasil_qty`): `qty / hasil_qty x total resep itu`; resep per porsi: `qty x total` |
| HPP menu | jumlah komponen + `biaya_lain` |
| Margin | `(harga jual outlet - HPP) / harga jual outlet` |
| Kategori | HIGH jika margin >= batas atas, LOW jika < batas bawah, selain itu SEDANG (Pengaturan). Dua batas sama = hanya HIGH/LOW |
| Harga online | harga outlet x (1 + markup), markup di Pengaturan (awal 25%) |

Bahan tanpa harga dihitung 0 dan menu yang memakainya diberi peringatan.

## Hasil migrasi dari file 27/11/2025

Dimigrasikan: **101 bahan** (94 di daftar + 7 yang hanya ada di sheet HPP), **37 resep**, **54 menu**,
5 kategori bahan, 7 kategori menu. Daftar kontak pelanggan di PDF tidak dipakai dan tidak disimpan.

- **HPP ke-54 menu sama persis dengan file** saat migrasi. Selisih antara HPP file dan komponen yang bisa
  diuraikan disimpan di `biaya_lain` ("Biaya lain, sisa dari file": packaging dkk). Isinya bisa diedit di popup menu.
- **Komposisi menu adalah perkiraan awal**: protein (Mamam Chicken / Wingers / Classic Chicken) + Nasi +
  Topping sesuai nama menu; Twins = 0,5 porsi Wingers. File tidak memuat rincian bahan per menu. Koreksi lewat SQL
  (contoh di bawah) kalau berbeda dengan praktik di dapur.
- Menu "Menu lain" nomor 3 sampai 5 (tanpa nama, HPP 0) tidak dimigrasikan.
- Harga bahan mengikuti **daftar bahan** (sumber tunggal). Beberapa resep di sheet HPP memakai harga yang berbeda,
  jadi total resepnya bergeser sedikit. HPP menu tidak ikut bergeser karena terkunci lewat `biaya_lain`.

| Resep | Di sheet | Di app | Penyebab |
|---|---|---|---|
| Tepung bumbu | Rp12.900 | Rp13.400 | Terigu di sheet Rp8.500, di daftar Rp9.000 |
| Mamam Chicken / Wingers | Rp8.629 / Rp9.839 | Rp8.669 / Rp9.879 | turunan Tepung bumbu |
| Classic Chicken | Rp7.406 | Rp7.396 | Minyak di sheet Rp44.000, di daftar Rp42.000; plus turunan Tepung bumbu |
| Packaging minuman | Rp715 | Rp765 | Sedotan: sheet isi 150, daftar isi 100 |
| Sambal Geprek | Rp64.860 | Rp65.397 | Total di sheet tidak menjumlah baris Gas (Rp537) |

Hal lain dari sheet yang perlu Anda ketahui: baris "Upah Produksi" resep Wingers kosong di sheet (harga `--`),
jadi tidak dimasukkan; "Sayap" resep Wingers memakai Rp35.000 per 10 pcs (daftar bahan: Rp40.000 per kg) sehingga
dibuat bahan terpisah "Sayap (10 pcs)"; "Chicken" Classic (Rp42.000 per 10 pcs), "Nasi (beras)", "Bawang Putih
Cincang Minyak", "Saos Sachet Mamam", dan "Garam & Oregano (paket)" hanya ada di sheet HPP.

## Mengubah komposisi modal

Di popup menu, tekan **Ubah komposisi**:

- **Takaran**: ubah angkanya lalu tekan Simpan (satuan mengikuti bahan: gr, ml, pcs; resep per porsi = jumlah porsi).
- **Hapus komponen**: ikon tempat sampah.
- **Tambah komponen**: pilih bahan atau resep, isi takaran, tekan Tambah. Kalau komponen itu sebelumnya sudah
  termasuk di "Biaya lain", centang opsi pengurangannya supaya modal tidak dobel.
- **Isi resep**: ketuk resep untuk membukanya, lalu ubah/hapus/tambah isinya dengan cara yang sama.
  Perubahan isi resep berlaku untuk **semua menu** yang memakai resep itu (jumlahnya ditampilkan di atas isi resep).
  Resep tidak bisa memuat dirinya sendiri, langsung maupun lewat resep lain.

"Biaya lain" selalu tersedia dan bisa diubah, termasuk dikosongkan.

## Yang belum ada di halaman

Membuat **bahan baru, resep baru, atau menu baru** belum bisa dari halaman (yang ada: ubah komposisi,
harga bahan, harga jual, biaya lain, kategori, dan pengaturan). Sementara itu lewat SQL Editor, contoh bahan baru:

```sql
insert into hpp_bahan (nama, kategori_id, satuan, isi, unit_dasar, harga)
select 'Keju Mozzarella', k.id, 'kg', 1000, 'gr', 120000
from hpp_kategori k where k.jenis = 'bahan' and k.nama = 'Primer';
```
