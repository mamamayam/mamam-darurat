# Aturan hitung gaji

**Keputusan pemilik:** Aplikasi C mengikuti aturan hitung **mamam-kasir (B)**, karena dinilai lebih matang
dan supaya migrasi ke B tidak menghasilkan angka yang berbeda. Pemilik juga menilai aturan di
mamam-global (A) lebih adil pada beberapa titik (lihat bawah) — itu dicatat di sini untuk dipertimbangkan
ulang saat B disempurnakan, BUKAN untuk diubah diam-diam di C.

Mesin: `src/features/payroll/payrollEngine.js` (port dari `payroll_engine.dart` di B).
Tes patokan: `payrollEngine.test.js` (nilainya sama dengan tes B; fixture dibuat otomatis dari `hrd_seed_data.dart`).

## Aturan B (yang dipakai C)

- Jam toko tetap 09:00–19:00.
- Lembur pagi hanya kalau masuk <= 08:30 (dihitung dari masuk sampai 09:00).
- Lembur sore hanya kalau pulang >= 19:30 (dihitung dari 19:00 sampai jam pulang).
- Uang lembur = floor(TOTAL menit lembur dalam periode / 30) x tarif per 30 menit.
- Upah hanya untuk menit di dalam 09:00–19:00, dibulatkan dari menit persis.
- Jam bolong dikurangi, hanya bagian di dalam jam toko.
- Bonus Full Time: masuk <= 09:00 dan pulang >= 19:00.
- Bolong yang nyangkut: dibayar sampai jam bolong setelah harinya lewat; di hari yang sama "perlu klarifikasi".

## Beda dengan mamam-global (A), diukur pada skenario yang sama

Karyawan 15.000/jam, lembur 5.000 per 30 menit, bonus FT 25.000. Angka = selisih B dikurangi A per hari.

| Kasus | A | B | B - A |
|---|---|---|---|
| Pulang 19:20 | dibayar sampai 19:20 | dibayar sampai 19:00 | -6.000 |
| Masuk 09:10, pulang 18:30 | jam dibulatkan naik ke 0,1 | menit persis | -1.000 |
| Masuk 09:07 / pulang 18:52 | dibulatkan naik | menit persis | -250 / -500 |
| Bolong 13:00-14:30 | dikurangi 90 mnt, jam dibulatkan naik | dikurangi 90 mnt, menit persis | -1.500 |
| Bolong nyangkut, hari sudah lewat | Rp 0 | dibayar sampai jam bolong | +60.000 |
| Bolong sebelum / lintas jam buka | bolong dikurangi walau di luar jam toko | hanya bagian di dalam jam toko | +1.500 / +2.500 |

Pada data seed B (September 2026), total upah+lembur+bonus FT B lebih rendah dari A:
-7.250 (Andi, 0,5%), -2.567 (Budi), -32.000 (Sari, 2,3%).

## Titik di aturan B yang paling mungkin merugikan karyawan

Ini aturan B yang disengaja, bukan bug di port. Kalau mau diubah, ubah di B DAN C bersamaan.

1. **Pulang 19:00–19:29**: menit di luar jam toko tidak dibayar sama sekali. Pulang 19:29 = Rp 0 untuk menit
   tambahan, pulang 19:30 = lembur 30 menit dibayar (ada "tebing").
2. **Masuk 08:31–08:59**: menit sebelum 09:00 tidak dibayar.
3. **Sisa menit lembur yang tidak genap 30** di akhir periode tidak dibayar (dibulatkan ke bawah).

## Kalau aturan diubah nanti

1. Ubah dulu di B: `lib/features/hrd/domain/payroll_engine.dart` dan `test/hrd_payroll_engine_test.dart`.
2. Samakan di C: `payrollEngine.js` dan `payrollEngine.test.js`. Nilai patokan bulanan di tes akan berubah;
   fixture `__fixtures__/hrdSeed.js` dibuat ulang dari seed B (bukan diedit tangan).
3. Jangan mengubah hanya salah satu: gaji yang dihitung C dan B untuk data yang sama harus tetap sama.
