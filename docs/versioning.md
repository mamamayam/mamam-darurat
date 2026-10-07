# Versi otomatis

Tiap push ke `main` menaikkan versi app sendiri. Tidak ada yang perlu diatur manual.

## Alurnya

1. Pemilik push ke `main`.
2. GitHub Action `.github/workflows/versioning.yml` membaca pesan commit di push itu
   dan menentukan kenaikan (tabel di bawah). Satu push berisi banyak commit memakai kenaikan **tertinggi**.
3. Versi baru ditulis ke `package.json` dan `package-lock.json`, di-commit sebagai
   `chore(release): vX.Y.Z` oleh bot, diberi tag `vX.Y.Z`, lalu di-push ke `main`.
4. Hosting (Vercel) membangun ulang dari commit itu. Saat build, `vite.config.js` menyuntikkan
   versi, hash commit, dan waktu build ke app. Hasilnya tampil, misalnya, `v0.2.0 · 7 Okt 09.30 · ab12cd3`
   di bawah tombol Keluar (menu Lainnya) dan di bawah keypad layar login.

Karena langkah 3 menambah commit di `main`, **jalankan `git pull` sebelum push berikutnya**.
Push pertama setelah itu sempat membangun dengan versi lama; build kedua (dari commit bot) menampilkan versi yang benar.

## Besar atau kecil: dari awalan pesan commit

| Awalan pesan commit | Naik | Contoh |
|---|---|---|
| `feat!:` / `feat(x)!:` / baris `BREAKING CHANGE:` di badan pesan | **major** | 1.4.7 → 2.0.0 |
| `feat:` / `feat(x):` | **minor** | 1.4.7 → 1.5.0 |
| `fix:` `refactor:` `chore:` `docs:` `perf:` `test:` `style:`, atau tanpa awalan | **patch** | 1.4.7 → 1.4.8 |

- Yang menentukan hanya **baris pertama** pesan (kecuali baris `BREAKING CHANGE:`).
- Setiap push minimal naik patch, jadi pesan lama seperti `push 7/10 v2` tetap dihitung (patch).
- Commit `chore(release): ...` milik bot tidak dihitung dan tidak memicu putaran baru.
- Hasil nyata mengikuti kebiasaan menulis pesan: kalau mau perubahan dihitung "fitur", tulis `feat:`.

Kapan memakai apa: **feat** = kemampuan baru yang terlihat pemakai (tab baru, layar baru). **fix** = perbaikan atau penyesuaian kecil.
**major** = perubahan yang mengubah cara kerja lama secara mendasar (mis. skema database tidak kompatibel, ganti sistem login).

## Komponen

| Berkas | Fungsi |
|---|---|
| `scripts/versioning.mjs` | Aturan murni: awalan pesan → level, naikkan versi. Dites di `scripts/versioning.test.js`. |
| `scripts/bump-version.mjs` | Membaca commit dari git, menulis `package.json` + `package-lock.json`. |
| `.github/workflows/versioning.yml` | Menjalankan skrip tiap push ke `main`, lalu commit + tag + push. |
| `vite.config.js` | Menyuntikkan `__APP_VERSION__` dan `__APP_BUILD__` (hash commit dari `VERCEL_GIT_COMMIT_SHA`, `GITHUB_SHA`, atau git lokal). |
| `src/lib/appVersion.js` | Memformat label versi (waktu ditampilkan dalam WIB). |

## Mencoba di laptop

```bash
node scripts/bump-version.mjs --message "feat: coba" --dry-run     # hanya tampilkan hasil
node scripts/bump-version.mjs --range origin/main..HEAD --dry-run  # dari commit yang belum di-push
```

Tanpa `--dry-run`, skrip menulis file; jangan dijalankan manual di repo kerja kecuali memang mau menaikkan versi
(Action akan menaikkan lagi saat push).

## Menggeser angka awal

Versi sekarang dimulai dari `0.1.0`. Ingin mulai dari angka lain (mis. `1.0.0`): ubah `version` di `package.json` dan di dua tempat
`package-lock.json` (baris 3 dan 9), commit dengan awalan `chore:`. Setelah itu otomatis berjalan dari angka itu.

## Catatan

- Kalau push ditolak karena berisi perubahan di `.github/workflows/`, token/kredensial Git perlu izin `workflow`
  (atau tambahkan berkas workflow lewat web GitHub sekali saja).
- Kalau suatu saat dibuat APK (Capacitor), `versionName`/`versionCode` Android harus disambungkan ke `package.json` supaya nomornya sama.
- Service worker memakai jaringan-dulu untuk halaman utama, jadi versi baru langsung terpakai saat app dibuka lagi dalam keadaan online;
  label versi di menu dipakai untuk memastikan HP sudah memakai build terbaru.
