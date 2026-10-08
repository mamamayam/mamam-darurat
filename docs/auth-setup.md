# Login Supabase Auth, Pengaturan, PIN karyawan

Ringkasan cara kerja dan langkah pasang. Urutan pasang ada di bagian "Langkah pasang".

## Cara kerja

| Hal | Perilaku |
|---|---|
| Akun | Dua akun Supabase Auth: **owner** dan **staf**. Layar login tetap cuma PIN 4 digit. |
| PIN → password | Password akun = `mamam:` + PIN (Supabase minta password ≥ 6 karakter). Aplikasi mencoba akun owner dulu, lalu staf. **PIN owner dan staf harus berbeda.** |
| Batas percobaan | 3x salah → login dikunci 15 menit, sheet **Lupa PIN** muncul. Dihitung di aplikasi (localStorage), bukan di server. |
| Lupa PIN | Pilih Owner/Staf → Supabase mengirim link reset ke email owner → buka link → layar **Buat PIN baru** (ketik 2x) → kembali ke login. |
| Lama sesi | Pengaturan → Login → Lama sesi (1 jam / 12 jam / 1 hari / 7 hari). Berlaku untuk login berikutnya. |
| Mode lama | Kalau `VITE_AUTH_OWNER_EMAIL` kosong, aplikasi memakai PIN lokal `src/auth/pins.js` (owner 3678, staf 0000) supaya tidak terkunci selama transisi. |
| Menu Pengaturan | Hanya owner. Isi: status login, ganti PIN owner, reset PIN staf, lama sesi, PIN karyawan. |
| Staf & Penggajian | Menu **Karyawan** tidak muncul untuk staf. Menu **Penggajian** muncul: staf memilih nama karyawan → memasukkan PIN karyawan → melihat gaji **dirinya sendiri** (mingguan / bulanan, hanya-lihat). |
| PIN karyawan | Diatur owner di Pengaturan → PIN Karyawan (4 digit, bisa acak). Disimpan sebagai hash SHA-256 bergaram di tabel `employee_pins`. 3x salah → terkunci 5 menit di perangkat itu; owner bisa mengganti PIN kapan saja. Ada saklar Aktif/Mati dan waktu tutup otomatis. |

## Langkah pasang

1. **Jalankan SQL** `supabase/migrations/008_auth_settings.sql` di Supabase → SQL Editor (sekali, aman diulang).
2. **Buat dua akun** di Supabase → Authentication → Users → Add user → *Create new user*, centang **Auto Confirm User**:
   - Owner: email owner, password `mamam:` + PIN owner. Contoh PIN 3678 → `mamam:3678`.
   - Staf: email `nama+staf@domain` (contoh `agungprayoga212+staf@gmail.com`), password `mamam:` + PIN staf. Contoh PIN 0000 → `mamam:0000`.
   - Pakai PIN yang sama dengan PIN sekarang supaya tidak ada yang berubah untuk pemakai.
3. **Matikan pendaftaran bebas**: Authentication → Sign In / Providers → matikan *Allow new users to sign up*. (Kalau tidak, orang lain bisa membuat akun sendiri.)
4. **URL untuk link reset**: Authentication → URL Configuration:
   - Site URL: `https://mamamkasirdarurat.vercel.app`
   - Redirect URLs: tambahkan `https://mamamkasirdarurat.vercel.app/**` dan `http://localhost:5173/**`
5. **Environment** (Vercel → Settings → Environment Variables, dan `.env.local` untuk lokal):
   - `VITE_AUTH_OWNER_EMAIL` = email owner (ke sini email Lupa PIN dikirim; **ketik dengan teliti**).
   - `VITE_AUTH_STAFF_EMAIL` = opsional. Kosong → otomatis `nama+staf@domain` dari email owner.
   Lalu redeploy.
6. Buka aplikasi, login dengan PIN. Cek: menu Pengaturan ada untuk owner; staf tidak melihat Karyawan/Pengaturan.
7. Pengaturan → PIN Karyawan → atur PIN tiap karyawan, lalu sampaikan ke orangnya.

Alias `+staf` hanya masuk ke kotak surat yang sama untuk Gmail (dan penyedia yang mendukung plus-addressing). Kalau email owner bukan Gmail, isi `VITE_AUTH_STAFF_EMAIL` dengan alamat lain yang kamu punya, lalu pakai alamat itu saat membuat akun staf.

## Mengganti PIN

- **PIN owner**: Pengaturan → Ganti PIN Owner.
- **PIN staf**: Pengaturan → Reset PIN Staf → link dikirim ke email → buka link di browser yang sama → buat PIN baru → login lagi dengan PIN owner. (Supabase tidak mengizinkan owner mengganti password akun lain langsung dari aplikasi tanpa server.)
- **Lupa PIN**: dari layar login (otomatis muncul setelah 3x salah).
- **PIN karyawan**: Pengaturan → PIN Karyawan → Ubah PIN.

## Batasan yang perlu diketahui (tingkat keamanan "Longgar")

- Database **tidak** ditutup untuk umum. Kebijakan RLS memberi akses penuh ke role `anon` dan `authenticated`. Login mengatur siapa yang bisa *masuk aplikasi*, tapi siapa pun yang punya URL + anon key masih bisa membaca/menulis lewat API. Cara menutupnya ada di komentar bagian bawah migrasi 008 (jalankan setelah semua perangkat memakai login Supabase).
- PIN karyawan hanyalah pagar tampilan antar-karyawan di perangkat toko: gaji semua orang tetap terbaca lewat API oleh siapa pun yang punya akses database. PIN 4 digit juga hanya 10.000 kemungkinan.
- Batas 3x salah dihitung di perangkat. Orang yang paham bisa menghapus localStorage dan mencoba lagi. Awalan `mamam:` terlihat di kode JavaScript; yang menjaga akun adalah PIN dan pembatasan percobaan.
- Supabase membatasi jumlah email bawaan (sedikit per jam). Kalau "Lupa PIN" gagal dengan pesan terlalu sering, tunggu beberapa menit. Untuk pemakaian rutin, pasang SMTP sendiri di Authentication → SMTP.
- Link reset berlaku singkat dan sekali pakai. Buka dari HP/browser yang sama dengan yang dipakai untuk meminta.

## Jalan keluar kalau terkunci total

Login terkunci 15 menit lalu terbuka sendiri. Kalau email owner salah ketik / tidak bisa diakses: ubah password akun di Supabase → Authentication → Users → (akun) → *Send password recovery* atau set password baru manual (`mamam:` + PIN baru).
