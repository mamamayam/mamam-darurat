-- =====================================================================
-- Migrasi 017 — Pengeluaran 5–15 Okt 2026 dari app lama (mamam-global / A).
-- Jalankan SEKALI di SQL Editor project C. Aman diulang (id baris tetap, tidak dobel).
--
-- Sumber: gabungan Supabase mamam-global + ekspor Excel lokal, sudah dibersihkan dari duplikat.
-- Bentuk barisnya SAMA PERSIS dengan hasil scripts/migrasi-dari-a.mjs (id uuid5 dari id lama,
-- created_by 'migrasi-dari-A', waktu dicatat diambil dari id lama), jadi kalau skrip itu dijalankan
-- belakangan, baris ini dikenali sebagai "sudahAda" dan tidak digandakan.
--
-- Isi: 92 pengeluaran (total Rp 6.175.000), tanggal 5–15 Okt 2026.
--  * Catatan "Kasbon Karyawan" TIDAK ikut (aturan skrip migrasi: kasbon diurus di modul Karyawan).
--  * 4 pengeluaran A bertanggal 16 Okt TIDAK ikut: sudah diketik ulang di C (Beras 4lt, Sunco 2,
--    LM 3 + Gas, Box L/M) — kalau ikut, jadi dobel.
--  * Waktu dicatat semuanya SEBELUM shift Dompet yang sedang terbuka, jadi Dompet tidak terpengaruh.
--  * Ada 1 pembersihan di bagian bawah: pengeluaran dobel-klik 6 Agu 2026 (Beras 4lt 54.000, dua kali
--    dalam 7 detik). Hanya baris kembarannya yang dihapus, dan hanya kalau kembaran aslinya masih ada.
-- =====================================================================

begin;

-- Trigger cek perangkat dimatikan sebentar (insert dari SQL Editor tidak membawa id perangkat);
-- dinyalakan lagi di bawah dalam transaksi yang sama.
alter table expenses disable trigger trg_stamp_perangkat;

insert into expenses (id, direction, category, amount, transaction_date, store_or_supplier_name, detail, payment_method, cash_holder_employee_id, cash_holder_name, created_at, created_by)
values
  ('ede6197e-7967-5a04-9e37-e638f8b34088', 'pengeluaran', 'Bayar Ayam', 300000, '2026-10-05', null, null, 'Non-Tunai', null, null, '2026-10-05T00:00:26.951Z', 'migrasi-dari-A'),
  ('ac8f1a48-4175-57a1-b2ac-fe6cf9213ad1', 'pengeluaran', 'Belanja', 42000, '2026-10-05', null, 'Sunco 1', 'Non-Tunai', null, null, '2026-10-05T00:00:35.544Z', 'migrasi-dari-A'),
  ('4466d454-457e-54be-95e7-3cdae65b5e30', 'pengeluaran', 'Belanja', 102000, '2026-10-05', null, 'Terigu, Masako, pucuk, sunlight, bon cabe, milo, batre,', 'Non-Tunai', null, null, '2026-10-05T02:53:01.128Z', 'migrasi-dari-A'),
  ('182dd5ec-4488-53c5-b85d-e1a23cd7b81f', 'pengeluaran', 'Belanja', 78000, '2026-10-05', null, 'Ayam 2 ekor', 'Non-Tunai', null, null, '2026-10-05T02:53:15.641Z', 'migrasi-dari-A'),
  ('fa4ec27d-53c6-587e-96d9-154958a9af00', 'pengeluaran', 'Belanja', 42000, '2026-10-05', null, 'Sunco 1', 'Non-Tunai', null, null, '2026-10-05T02:53:21.724Z', 'migrasi-dari-A'),
  ('7af50597-e5e1-5344-8dea-65f1e4c7f05b', 'pengeluaran', 'Belanja', 13000, '2026-10-05', null, 'Sachet tomat 2', 'Non-Tunai', null, null, '2026-10-05T02:53:33.228Z', 'migrasi-dari-A'),
  ('9fd4cd8e-0a3a-5e26-b41b-946b5075adf0', 'pengeluaran', 'Belanja', 52000, '2026-10-05', null, 'Beras 4', 'Non-Tunai', null, null, '2026-10-05T02:53:50.654Z', 'migrasi-dari-A'),
  ('9f87797a-fea2-5d7c-86f1-7991fc29d4e7', 'pengeluaran', 'Belanja', 70000, '2026-10-05', null, 'Paket box s', 'Tunai', null, null, '2026-10-05T08:15:39.226Z', 'migrasi-dari-A'),
  ('1d59904c-887c-55f9-83aa-7eb214def5b4', 'pengeluaran', 'Biaya', 2000, '2026-10-06', null, 'Parkir', 'Tunai', null, null, '2026-10-06T08:13:11.420Z', 'migrasi-dari-A'),
  ('79ae729e-1215-5249-99c1-4ed0cdae96e2', 'pengeluaran', 'Belanja', 108000, '2026-10-06', null, 'Paket bumbu', 'Tunai', null, null, '2026-10-06T09:03:53.147Z', 'migrasi-dari-A'),
  ('0b6016d3-ba2e-5dc5-bef2-e811a568d0ed', 'pengeluaran', 'Belanja', 16000, '2026-10-06', null, 'Thaitea', 'Tunai', null, null, '2026-10-06T10:21:56.958Z', 'migrasi-dari-A'),
  ('848e36e1-40c6-5ebe-aaa3-2e14661fdf55', 'pengeluaran', 'Belanja', 52000, '2026-10-06', null, 'Beras 4lt', 'Non-Tunai', null, null, '2026-10-06T11:43:57.452Z', 'migrasi-dari-A'),
  ('31e43106-4c52-5401-b523-0b1c2e785aff', 'pengeluaran', 'Belanja', 50000, '2026-10-06', null, 'Mamayo, sendok, plastik 6×20', 'Non-Tunai', null, null, '2026-10-06T11:44:11.875Z', 'migrasi-dari-A'),
  ('578aa762-e27c-56f6-ad74-9b68ab5f90d0', 'pengeluaran', 'Belanja', 77000, '2026-10-07', null, 'Ayam 2 ekor', 'Non-Tunai', null, null, '2026-10-07T02:29:10.425Z', 'migrasi-dari-A'),
  ('6acf1188-5f2c-5c68-a37b-7b9ca38bf1a7', 'pengeluaran', 'Belanja', 39000, '2026-10-07', null, 'Gas 1, LM 2', 'Non-Tunai', null, null, '2026-10-07T02:29:30.710Z', 'migrasi-dari-A'),
  ('489e23d6-c5fe-5fd6-b2b5-08fa03db5742', 'pengeluaran', 'Belanja', 52000, '2026-10-07', null, 'Beras 4', 'Non-Tunai', null, null, '2026-10-07T02:29:41.108Z', 'migrasi-dari-A'),
  ('b5b47229-d230-5a3e-b772-4b7065bef165', 'pengeluaran', 'Belanja', 5000, '2026-10-07', null, 'Poci', 'Tunai', null, null, '2026-10-07T07:16:22.953Z', 'migrasi-dari-A'),
  ('00e1d8dd-87ef-586f-9b2c-a438301ec1ab', 'pengeluaran', 'Belanja', 31000, '2026-10-07', null, null, 'Non-Tunai', null, null, '2026-10-07T09:02:21.758Z', 'migrasi-dari-A'),
  ('44f19142-feb9-54d6-b06f-c75bd04177d7', 'pengeluaran', 'Belanja', 35000, '2026-10-07', null, null, 'Non-Tunai', null, null, '2026-10-07T09:02:43.268Z', 'migrasi-dari-A'),
  ('cf3e2fde-713a-5e84-aea6-8d8ae5c496c7', 'pengeluaran', 'Belanja', 5000, '2026-10-07', null, 'Poci', 'Tunai', null, null, '2026-10-07T09:50:03.717Z', 'migrasi-dari-A'),
  ('83b3771b-ed51-511f-ba81-20065f19cf22', 'pengeluaran', 'Belanja', 36000, '2026-10-08', null, 'Rayyan, (kertas nasi, saos tomat, sachet cabe)', 'Non-Tunai', null, null, '2026-10-08T10:04:54.353Z', 'migrasi-dari-A'),
  ('e722d2eb-797d-5267-a820-0854961e44e0', 'pengeluaran', 'Belanja', 78000, '2026-10-08', null, 'Beras 6lt', 'Non-Tunai', null, null, '2026-10-08T10:05:16.637Z', 'migrasi-dari-A'),
  ('e5087b3f-f05c-55de-bfa8-280e4c7aef6b', 'pengeluaran', 'Belanja', 28500, '2026-10-08', null, 'LM 2, Yakult 1', 'Non-Tunai', null, null, '2026-10-08T10:05:38.469Z', 'migrasi-dari-A'),
  ('db1cbbeb-7d01-5374-a49f-0c16dc89230a', 'pengeluaran', 'Belanja', 87000, '2026-10-08', null, 'Sunco 2', 'Non-Tunai', null, null, '2026-10-08T10:05:47.265Z', 'migrasi-dari-A'),
  ('959058bd-bc6f-537c-b087-0278971b0fc5', 'pengeluaran', 'Bayar Ayam', 245000, '2026-10-08', null, null, 'Non-Tunai', null, null, '2026-10-08T10:05:57.511Z', 'migrasi-dari-A'),
  ('f4fe0d6d-8b2f-5df6-bd73-73fafa63d126', 'pengeluaran', 'Belanja', 78000, '2026-10-09', null, 'Ayam 2 ekor', 'Non-Tunai', null, null, '2026-10-09T02:48:03.038Z', 'migrasi-dari-A'),
  ('9a413143-8c3f-5426-b9f5-865539e2c477', 'pengeluaran', 'Belanja', 55500, '2026-10-09', null, 'Sendok 1, plastik 24, plastik 1kg, LM 3', 'Non-Tunai', null, null, '2026-10-09T02:48:25.847Z', 'migrasi-dari-A'),
  ('28f91337-74ab-5bbd-b942-0d6a7b211bf8', 'pengeluaran', 'Belanja', 20000, '2026-10-09', null, 'Esbatu', 'Tunai', null, null, '2026-10-09T04:40:29.533Z', 'migrasi-dari-A'),
  ('d0d18474-6f73-5780-8c24-92dd62c7fd12', 'pengeluaran', 'Belanja', 50000, '2026-10-09', null, 'Plastik 2kg, kentang, sendok, bon cabe', 'Tunai', null, null, '2026-10-09T06:20:58.964Z', 'migrasi-dari-A'),
  ('af94fde1-fc05-52c3-b419-63241d7bc7e1', 'pengeluaran', 'Belanja', 5000, '2026-10-09', null, 'Poci', 'Tunai', null, null, '2026-10-09T06:29:22.412Z', 'migrasi-dari-A'),
  ('6ffb05cb-75f5-562f-a302-8bbe5adba05d', 'pengeluaran', 'Belanja', 30000, '2026-10-09', null, 'Terigu', 'Tunai', null, null, '2026-10-09T06:37:21.220Z', 'migrasi-dari-A'),
  ('b10176a1-399d-5a34-a7de-ff74e3938d92', 'pengeluaran', 'Belanja', 28000, '2026-10-09', null, 'Skm, nori', 'Non-Tunai', null, null, '2026-10-09T11:34:16.697Z', 'migrasi-dari-A'),
  ('e2954ff8-c338-5cdb-bcdb-d0d6da302966', 'pengeluaran', 'Belanja', 2000, '2026-10-09', null, 'Parkir harmul', 'Tunai', null, null, '2026-10-09T12:32:40.963Z', 'migrasi-dari-A'),
  ('389dc8d2-fecf-5e6c-a322-79cdeabf4762', 'pengeluaran', 'Belanja', 94000, '2026-10-09', null, 'Box M', 'Non-Tunai', null, null, '2026-10-09T12:47:14.400Z', 'migrasi-dari-A'),
  ('a1c705fd-32f1-584d-8c0c-ff00e896126d', 'pengeluaran', 'Belanja', 39000, '2026-10-10', null, 'Ayam 1 ekor', 'Non-Tunai', null, null, '2026-10-10T02:56:06.474Z', 'migrasi-dari-A'),
  ('b4c4f5af-7d71-513a-963c-5ed9c549b2ad', 'pengeluaran', 'Bayar Ayam', 380000, '2026-10-10', null, null, 'Non-Tunai', null, null, '2026-10-10T02:56:18.193Z', 'migrasi-dari-A'),
  ('52b6950c-8470-5944-acc1-54dd03387ce4', 'pengeluaran', 'Belanja', 56000, '2026-10-10', null, 'Beras 4lt', 'Non-Tunai', null, null, '2026-10-10T02:56:27.305Z', 'migrasi-dari-A'),
  ('cbafe8ef-8758-5ddd-b16c-a322bd231097', 'pengeluaran', 'Belanja', 74000, '2026-10-10', null, 'Cabe geprek', 'Non-Tunai', null, null, '2026-10-10T02:57:29.341Z', 'migrasi-dari-A'),
  ('f2449092-833e-5d7e-8409-30e62fa593c3', 'pengeluaran', 'Belanja', 19000, '2026-10-10', null, 'Uht', 'Non-Tunai', null, null, '2026-10-10T02:57:39.631Z', 'migrasi-dari-A'),
  ('e43dd00a-e3ed-5ae0-957e-352c71d8bd26', 'pengeluaran', 'Belanja', 14000, '2026-10-10', null, 'Mango', 'Tunai', null, null, '2026-10-10T11:06:25.077Z', 'migrasi-dari-A'),
  ('ef2fdcbb-a30b-5994-ba4c-57945ab2f606', 'pengeluaran', 'Belanja', 5000, '2026-10-11', null, 'Poci', 'Tunai', null, null, '2026-10-11T04:33:43.236Z', 'migrasi-dari-A'),
  ('d20b5b6a-8763-53d3-a300-89b798031c00', 'pengeluaran', 'Biaya', 2000, '2026-10-11', null, 'Parkir', 'Tunai', null, null, '2026-10-11T04:33:53.200Z', 'migrasi-dari-A'),
  ('ce1d9aba-7c72-5c1d-907c-f7ecf06be10d', 'pengeluaran', 'Biaya', 48500, '2026-10-11', null, 'Paket a agung', 'Tunai', null, null, '2026-10-11T04:43:46.724Z', 'migrasi-dari-A'),
  ('d957e5a4-926e-5032-9102-26059336dc46', 'pengeluaran', 'Belanja', 78000, '2026-10-11', null, 'Beras 6lt', 'Non-Tunai', null, null, '2026-10-11T06:08:34.255Z', 'migrasi-dari-A'),
  ('f6a7f240-ab7d-56a8-9bac-f42c8db03b00', 'pengeluaran', 'Belanja', 90000, '2026-10-11', null, 'Sunco 2 pch', 'Non-Tunai', null, null, '2026-10-11T06:08:41.752Z', 'migrasi-dari-A'),
  ('2b4187a6-baab-5d51-85c3-c441d42dd7d7', 'pengeluaran', 'Belanja', 22000, '2026-10-11', null, 'Foam 20, box L 10', 'Non-Tunai', null, null, '2026-10-11T06:09:34.938Z', 'migrasi-dari-A'),
  ('7e16c741-ca23-5181-ad13-dff5a5d36096', 'pengeluaran', 'Belanja', 78000, '2026-10-11', null, 'Ayam 2 ekor', 'Non-Tunai', null, null, '2026-10-11T06:09:52.468Z', 'migrasi-dari-A'),
  ('03e06fec-38a9-5982-b898-0c19ff44256d', 'pengeluaran', 'Bayar Ayam', 190000, '2026-10-11', null, '9/10', 'Non-Tunai', null, null, '2026-10-11T06:10:10.470Z', 'migrasi-dari-A'),
  ('27e506cf-0a03-53a2-94f5-4dd08cfb9094', 'pengeluaran', 'Belanja', 5000, '2026-10-11', null, 'Poci', 'Tunai', null, null, '2026-10-11T06:29:36.257Z', 'migrasi-dari-A'),
  ('7fa2f972-3795-5035-9f98-67f6c17de91d', 'pengeluaran', 'Belanja', 35000, '2026-10-11', null, 'Rayan', 'Tunai', null, null, '2026-10-11T07:17:57.249Z', 'migrasi-dari-A'),
  ('9735e2a2-f587-562e-9e70-76ecdb700990', 'pengeluaran', 'Belanja', 22000, '2026-10-11', null, 'Boncabe', 'Tunai', null, null, '2026-10-11T07:18:17.245Z', 'migrasi-dari-A'),
  ('a634cca8-137b-52a2-ab75-0ca35fb94579', 'pengeluaran', 'Biaya', 2000, '2026-10-11', null, 'Parkir', 'Tunai', null, null, '2026-10-11T10:52:34.604Z', 'migrasi-dari-A'),
  ('6cdde43b-f1d1-5a53-8f5e-117fec553977', 'pengeluaran', 'Belanja', 94000, '2026-10-11', null, 'Box m', 'Tunai', null, null, '2026-10-11T10:57:46.182Z', 'migrasi-dari-A'),
  ('9a1af173-de00-5cf5-9a0b-dba25ed6548a', 'pengeluaran', 'Belanja', 10000, '2026-10-12', null, 'Poci', 'Tunai', null, null, '2026-10-12T03:25:07.546Z', 'migrasi-dari-A'),
  ('c461bef7-212f-54df-b528-809d5c2e0e19', 'pengeluaran', 'Belanja', 105000, '2026-10-12', null, 'Biang', 'Non-Tunai', null, null, '2026-10-12T09:37:46.274Z', 'migrasi-dari-A'),
  ('f4eded92-b7fd-552e-8343-29693b9ffbec', 'pengeluaran', 'Belanja', 312000, '2026-10-12', null, 'Ayam 8 ekor', 'Non-Tunai', null, null, '2026-10-12T09:37:59.663Z', 'migrasi-dari-A'),
  ('196016c3-18d6-5275-bc7f-fba13334c70f', 'pengeluaran', 'Bayar Ayam', 188000, '2026-10-12', null, '10/10', 'Non-Tunai', null, null, '2026-10-12T09:38:10.014Z', 'migrasi-dari-A'),
  ('017438ca-9d35-5588-b2a6-366ce04ecb73', 'pengeluaran', 'Belanja', 104000, '2026-10-12', null, 'Beras 8lt', 'Non-Tunai', null, null, '2026-10-12T09:38:21.237Z', 'migrasi-dari-A'),
  ('7bcc9626-d110-5084-927f-0e970cdcca14', 'pengeluaran', 'Belanja', 45000, '2026-10-12', null, 'Sunco 1', 'Non-Tunai', null, null, '2026-10-12T09:38:25.859Z', 'migrasi-dari-A'),
  ('b809e150-b7b7-55e3-918e-24569843d298', 'pengeluaran', 'Belanja', 38000, '2026-10-12', null, 'LM 4', 'Non-Tunai', null, null, '2026-10-12T09:38:47.095Z', 'migrasi-dari-A'),
  ('36cf9bcf-de7a-5c6f-bd0a-ace8746b89c4', 'pengeluaran', 'Belanja', 10500, '2026-10-12', null, 'Yakult', 'Non-Tunai', null, null, '2026-10-12T09:38:51.865Z', 'migrasi-dari-A'),
  ('a841e1cc-1aea-5615-8d01-c9c5b078cd92', 'pengeluaran', 'Belanja', 50000, '2026-10-12', null, 'Rayyan', 'Non-Tunai', null, null, '2026-10-12T11:53:42.012Z', 'migrasi-dari-A'),
  ('d63297f4-7003-5fac-b626-ea206ab84257', 'pengeluaran', 'Belanja', 52000, '2026-10-13', null, 'Beras 4', 'Non-Tunai', null, null, '2026-10-13T02:14:42.054Z', 'migrasi-dari-A'),
  ('f518ede4-4f29-549f-89d4-20108e529858', 'pengeluaran', 'Belanja', 45000, '2026-10-13', null, 'Sunco 1', 'Non-Tunai', null, null, '2026-10-13T02:14:48.424Z', 'migrasi-dari-A'),
  ('e6bdc54c-1bab-5047-9cf1-f06f456bb29a', 'pengeluaran', 'Belanja', 98000, '2026-10-13', null, 'Cabe2an', 'Non-Tunai', null, null, '2026-10-13T02:15:39.552Z', 'migrasi-dari-A'),
  ('c6309d4a-dbca-55c1-94b1-0f324172b02e', 'pengeluaran', 'Belanja', 47500, '2026-10-13', null, 'LM 5', 'Non-Tunai', null, null, '2026-10-13T02:16:37.232Z', 'migrasi-dari-A'),
  ('2fadbda1-4e23-5ba1-b6bf-70652f223f25', 'pengeluaran', 'Bayar Ayam', 190000, '2026-10-13', null, '11/10', 'Non-Tunai', null, null, '2026-10-13T04:31:43.512Z', 'migrasi-dari-A'),
  ('6fecef35-4010-5b92-9c8d-129d563310c5', 'pengeluaran', 'Belanja', 29000, '2026-10-13', null, 'Gula, mentega', 'Non-Tunai', null, null, '2026-10-13T04:32:09.020Z', 'migrasi-dari-A'),
  ('b8087572-4c91-5bf7-a1b9-a6ec36c5e2e9', 'pengeluaran', 'Belanja', 60000, '2026-10-13', null, 'Bbq, cabe', 'Non-Tunai', null, null, '2026-10-13T04:32:17.164Z', 'migrasi-dari-A'),
  ('3462abbc-9ecb-521c-b106-6d12b7b35db2', 'pengeluaran', 'Belanja', 43000, '2026-10-13', null, 'S inggeris', 'Non-Tunai', null, null, '2026-10-13T04:32:23.194Z', 'migrasi-dari-A'),
  ('315b5db6-8f01-5be7-86fa-872a62acce65', 'pengeluaran', 'Belanja', 29000, '2026-10-13', null, 'Nori, s tomat 2', 'Non-Tunai', null, null, '2026-10-13T04:32:39.031Z', 'migrasi-dari-A'),
  ('d7124144-e352-5071-bddd-8e93b135f0cb', 'pengeluaran', 'Belanja', 34000, '2026-10-13', null, 'Gourmet, tomat', 'Non-Tunai', null, null, '2026-10-13T04:33:26.899Z', 'migrasi-dari-A'),
  ('2b051a46-e9b4-5fd3-819b-d829e9f1136b', 'pengeluaran', 'Belanja', 33000, '2026-10-13', null, 'Kentang', 'Tunai', null, null, '2026-10-13T10:16:54.681Z', 'migrasi-dari-A'),
  ('77f5d575-45fc-5d5d-bd81-b150aec5ec79', 'pengeluaran', 'Belanja', 15000, '2026-10-13', null, 'Plastik 17', 'Non-Tunai', null, null, '2026-10-13T10:31:46.273Z', 'migrasi-dari-A'),
  ('60291bcb-838a-5281-b87b-46517b790c42', 'pengeluaran', 'Belanja', 35000, '2026-10-13', null, 'Minyak', 'Non-Tunai', null, null, '2026-10-13T10:31:51.979Z', 'migrasi-dari-A'),
  ('0a02b9f9-7117-50b8-93a9-99ae2dd4711d', 'pengeluaran', 'Belanja', 53000, '2026-10-14', null, 'Rayyan', 'Non-Tunai', null, null, '2026-10-14T02:40:19.315Z', 'migrasi-dari-A'),
  ('6b0059c6-9cb0-52cd-86d8-55365397e5d5', 'pengeluaran', 'Belanja', 16000, '2026-10-14', null, 'Sereh, daun jeruk, mecin', 'Non-Tunai', null, null, '2026-10-14T02:40:33.175Z', 'migrasi-dari-A'),
  ('4589474e-9150-57f4-b33b-f1e6aa55de58', 'pengeluaran', 'Belanja', 52000, '2026-10-14', null, 'Beras 4lt', 'Non-Tunai', null, null, '2026-10-14T02:40:38.147Z', 'migrasi-dari-A'),
  ('ea2e1246-20f3-5ea3-bb33-da8ff208b6ca', 'pengeluaran', 'Belanja', 22000, '2026-10-14', null, 'Bon cabe', 'Tunai', null, null, '2026-10-14T04:23:11.600Z', 'migrasi-dari-A'),
  ('b329bd3c-21a3-5348-87d9-a3bd324e98f1', 'pengeluaran', 'Belanja', 21000, '2026-10-14', null, 'Gas', 'Tunai', null, null, '2026-10-14T07:08:41.641Z', 'migrasi-dari-A'),
  ('095d2de6-6ef4-50a3-ad74-6c50431cf4fb', 'pengeluaran', 'Belanja', 22000, '2026-10-14', null, 'Risol', 'Tunai', null, null, '2026-10-14T09:20:41.408Z', 'migrasi-dari-A'),
  ('a55ea717-96ec-5dba-8829-c9d68a212fd4', 'pengeluaran', 'Belanja', 58000, '2026-10-14', null, 'Rayyan, uht, plastik, cup 35, LM', 'Non-Tunai', null, null, '2026-10-14T10:28:25.228Z', 'migrasi-dari-A'),
  ('9e8a3a9c-72e2-5cb6-a4fc-1554b155da28', 'pengeluaran', 'Belanja', 64000, '2026-10-15', null, 'Biang bosgil', 'Non-Tunai', null, null, '2026-10-14T23:42:39.582Z', 'migrasi-dari-A'),
  ('0a02a6d2-c169-59ca-aa61-3c0dd43e4ab0', 'pengeluaran', 'Bayar Ayam', 400000, '2026-10-15', null, null, 'Non-Tunai', null, null, '2026-10-14T23:42:45.053Z', 'migrasi-dari-A'),
  ('ed077908-699d-512c-b354-17fd2227e861', 'pengeluaran', 'Bayar Ayam', 170000, '2026-10-15', null, null, 'Non-Tunai', null, null, '2026-10-15T05:26:33.463Z', 'migrasi-dari-A'),
  ('4d4eca67-ebf0-5799-84db-b869b5a870cc', 'pengeluaran', 'Belanja', 117000, '2026-10-15', null, 'Ayam 3 ekor', 'Non-Tunai', null, null, '2026-10-15T05:26:45.016Z', 'migrasi-dari-A'),
  ('564c6789-9829-5f48-b0ce-e6a3f6b6f448', 'pengeluaran', 'Belanja', 20000, '2026-10-15', null, 'Milo 10', 'Non-Tunai', null, null, '2026-10-15T05:26:52.816Z', 'migrasi-dari-A'),
  ('c07b255e-6371-5137-aa87-fb7be980a37f', 'pengeluaran', 'Belanja', 135000, '2026-10-15', null, 'Sunco 3', 'Non-Tunai', null, null, '2026-10-15T05:27:00.497Z', 'migrasi-dari-A'),
  ('c983271f-e464-56c9-ba74-8c91d2990b37', 'pengeluaran', 'Belanja', 78000, '2026-10-15', null, 'Beras 6', 'Non-Tunai', null, null, '2026-10-15T05:27:06.696Z', 'migrasi-dari-A'),
  ('96387ed1-53d3-5952-8fb2-e74bff43f186', 'pengeluaran', 'Belanja', 35500, '2026-10-15', null, 'LM 3, karet', 'Non-Tunai', null, null, '2026-10-15T05:27:23.783Z', 'migrasi-dari-A'),
  ('c3747d90-c256-581c-a2d0-997dc2f0b154', 'pengeluaran', 'Belanja', 37000, '2026-10-15', null, 'Rayyan, plastik 24, masako', 'Non-Tunai', null, null, '2026-10-15T05:27:32.343Z', 'migrasi-dari-A'),
  ('9abb1de8-2947-502f-a873-39ba18caa8de', 'pengeluaran', 'Belanja', 40000, '2026-10-15', null, 'Bumbu', 'Tunai', null, null, '2026-10-15T11:13:21.215Z', 'migrasi-dari-A')
on conflict (id) do nothing;

alter table expenses enable trigger trg_stamp_perangkat;

-- Buang dobel-klik 6 Agu 2026 (kembaran yang dicatat 7 detik kemudian).
delete from expenses d
 where d.id = '6bd845ac-6821-5acd-b8a8-61171e63ce23'
   and d.created_by = 'migrasi-dari-A' and d.amount = 54000 and d.transaction_date = '2026-08-06' and d.detail = 'Beras 4lt'
   and exists (select 1 from expenses k where k.id = '14601be6-103c-5255-803f-5d1c7ef6f331');

commit;

-- CEK HASIL (tampil di SQL Editor). Setelah dijalankan, yang bertanda migrasi-dari-A harus:
--   pengeluaran: 1002 baris, total 54741000   | 5–15 Okt: 92 baris, total 6175000   | masuk_dompet: 0
select count(*) filter (where direction = 'pengeluaran') as pengeluaran_migrasi,
       sum(amount) filter (where direction = 'pengeluaran') as total_migrasi,
       count(*) filter (where direction = 'pengeluaran' and transaction_date between '2026-10-05' and '2026-10-15') as baris_5_15_okt,
       sum(amount) filter (where direction = 'pengeluaran' and transaction_date between '2026-10-05' and '2026-10-15') as total_5_15_okt,
       (select count(*) from expenses x join shifts s on x.created_at >= s.opened_at and (s.closed_at is null or x.created_at <= s.closed_at)
         where x.created_by = 'migrasi-dari-A' and x.direction = 'pengeluaran') as masuk_dompet
from expenses where created_by = 'migrasi-dari-A';
