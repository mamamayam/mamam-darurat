-- =====================================================================
-- Migrasi 013 — HPP (bahan, resep, menu, riwayat harga, kategori, pengaturan).
-- Jalankan SEKALI di SQL Editor project C. Aman diulang.
-- Urutan: 013_hpp.sql  ->  014_hpp_data_awal.sql  ->  daftarkan akun admin (lihat bawah).
--
-- KEAMANAN (BEDA dari tabel POS lain, sengaja):
--   Tabel POS memakai tingkat "Longgar" (anon + authenticated bebas). Data HPP (harga beli,
--   modal, margin) JAUH lebih sensitif, jadi di sini:
--     * role `anon` TIDAK punya akses sama sekali;
--     * role `authenticated` hanya boleh jika akunnya terdaftar di tabel hpp_admin.
--   Akun staf POS yang sudah login TETAP tidak bisa membaca HPP.
--
-- Model:
--   hpp_bahan        bahan baku + harga beli. Harga per unit dasar = harga / isi.
--   hpp_resep        resep. hasil_qty kosong = HPP per porsi; terisi = resep batch (mis. saos 3000 gr).
--   hpp_resep_item   isi resep: bahan ATAU resep lain (bertingkat), qty dalam unit dasar / porsi.
--   hpp_menu         menu jual. HPP = jumlah komponen + biaya_lain (sisa yang belum diuraikan).
--   hpp_menu_item    komponen menu: resep ATAU bahan langsung.
--   hpp_harga_riwayat  riwayat perubahan harga (hanya bisa ditambah lewat trigger, tidak bisa diubah/dihapus).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin HPP
-- ---------------------------------------------------------------------
create table if not exists hpp_admin (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  dibuat_pada timestamptz not null default now()
);
alter table hpp_admin enable row level security;   -- tanpa policy: tidak bisa dibaca langsung lewat API
revoke all on hpp_admin from anon, authenticated;

create or replace function hpp_is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.hpp_admin where user_id = auth.uid())
$$;
revoke all on function hpp_is_admin() from public, anon;
grant execute on function hpp_is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table if not exists hpp_kategori (
  id          uuid primary key default gen_random_uuid(),
  jenis       text not null check (jenis in ('bahan', 'menu')),
  nama        text not null check (length(btrim(nama)) > 0),
  urutan      integer not null default 0,
  dibuat_pada timestamptz not null default now(),
  unique (jenis, nama)
);

create table if not exists hpp_bahan (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null unique check (length(btrim(nama)) > 0),
  kategori_id uuid references hpp_kategori(id) on delete restrict,
  satuan      text not null default 'pcs',                          -- satuan beli, hanya label: kg, pack, 50 pcs
  isi         numeric not null default 1 check (isi > 0),           -- jumlah unit dasar dalam satu satuan beli
  unit_dasar  text not null default 'pcs',                          -- gr, ml, pcs, porsi
  harga       numeric check (harga is null or harga >= 0),          -- harga per satuan beli; kosong = belum diisi
  harga_acuan numeric,                                              -- pembanding perubahan modal ("sejak acuan")
  catatan     text,
  aktif       boolean not null default true,
  dibuat_pada timestamptz not null default now(),
  diubah_pada timestamptz not null default now()
);
create index if not exists idx_hpp_bahan_kategori on hpp_bahan (kategori_id);

create table if not exists hpp_harga_riwayat (
  id           uuid primary key default gen_random_uuid(),
  bahan_id     uuid not null references hpp_bahan(id) on delete cascade,
  harga        numeric not null,
  harga_sebelum numeric,
  catatan      text,
  sumber       text not null default 'manual',                      -- manual, modal_menu, migrasi
  dibuat_oleh  uuid,
  dibuat_pada  timestamptz not null default now()
);
create index if not exists idx_hpp_riwayat_bahan on hpp_harga_riwayat (bahan_id, dibuat_pada desc);

create table if not exists hpp_resep (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null unique check (length(btrim(nama)) > 0),
  grup       text not null default 'Resep',
  hasil_qty  numeric check (hasil_qty is null or hasil_qty > 0),    -- resep batch: total hasil dalam hasil_unit
  hasil_unit text,
  urutan     integer not null default 0,
  catatan    text
);

create table if not exists hpp_resep_item (
  id           uuid primary key default gen_random_uuid(),
  resep_id     uuid not null references hpp_resep(id) on delete cascade,
  urutan       integer not null default 0,
  bahan_id     uuid references hpp_bahan(id) on delete restrict,
  sub_resep_id uuid references hpp_resep(id) on delete restrict,
  qty          numeric not null check (qty >= 0),
  check ((bahan_id is not null) <> (sub_resep_id is not null)),
  check (sub_resep_id is distinct from resep_id)
);
create index if not exists idx_hpp_resep_item_resep on hpp_resep_item (resep_id);

create table if not exists hpp_menu (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null check (length(btrim(nama)) > 0),
  kategori_id  uuid references hpp_kategori(id) on delete restrict,
  harga_outlet numeric not null default 0 check (harga_outlet >= 0),
  biaya_lain   numeric not null default 0,                          -- sisa HPP yang belum diuraikan ke komponen
  hpp_file     numeric,                                             -- HPP di file asal (hanya informasi)
  urutan       integer not null default 0,
  aktif        boolean not null default true,
  dibuat_pada  timestamptz not null default now(),
  unique (kategori_id, nama)
);

create table if not exists hpp_menu_item (
  id       uuid primary key default gen_random_uuid(),
  menu_id  uuid not null references hpp_menu(id) on delete cascade,
  urutan   integer not null default 0,
  resep_id uuid references hpp_resep(id) on delete restrict,
  bahan_id uuid references hpp_bahan(id) on delete restrict,
  qty      numeric not null check (qty >= 0),
  check ((resep_id is not null) <> (bahan_id is not null))
);
create index if not exists idx_hpp_menu_item_menu on hpp_menu_item (menu_id);

create table if not exists hpp_setting (
  key         text primary key,
  value       jsonb not null,
  diubah_pada timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Trigger: tiap harga bahan berubah, otomatis tercatat di riwayat.
-- Catatan/sumber dibawa dari hpp_ubah_harga lewat setelan transaksi (hpp.catatan, hpp.sumber).
-- ---------------------------------------------------------------------
create or replace function hpp_catat_harga() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_catatan text; v_sumber text;
begin
  v_catatan := nullif(current_setting('hpp.catatan', true), '');
  v_sumber  := nullif(current_setting('hpp.sumber', true), '');
  if tg_op = 'INSERT' then
    if new.harga is not null then
      insert into hpp_harga_riwayat (bahan_id, harga, harga_sebelum, catatan, sumber, dibuat_oleh)
      values (new.id, new.harga, null, coalesce(v_catatan, 'Harga awal'), coalesce(v_sumber, 'migrasi'), auth.uid());
    end if;
  elsif new.harga is not null and new.harga is distinct from old.harga then
    insert into hpp_harga_riwayat (bahan_id, harga, harga_sebelum, catatan, sumber, dibuat_oleh)
    values (new.id, new.harga, old.harga, v_catatan, coalesce(v_sumber, 'manual'), auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists trg_hpp_catat_harga on hpp_bahan;
create trigger trg_hpp_catat_harga after insert or update of harga on hpp_bahan
  for each row execute function hpp_catat_harga();

create or replace function hpp_stamp_diubah() returns trigger language plpgsql as $$
begin new.diubah_pada := now(); return new; end $$;
drop trigger if exists trg_hpp_bahan_diubah on hpp_bahan;
create trigger trg_hpp_bahan_diubah before update on hpp_bahan
  for each row execute function hpp_stamp_diubah();

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------
-- Ubah harga bahan + catat riwayat dalam satu transaksi. Hak akses mengikuti RLS (hanya admin HPP).
create or replace function hpp_ubah_harga(p_bahan uuid, p_harga numeric, p_catatan text default null, p_sumber text default 'manual')
returns void language plpgsql set search_path = public as $$
begin
  if p_harga is null or p_harga < 0 then raise exception 'Harga tidak valid'; end if;
  perform set_config('hpp.catatan', coalesce(p_catatan, ''), true);
  perform set_config('hpp.sumber', coalesce(p_sumber, 'manual'), true);
  update hpp_bahan set harga = p_harga where id = p_bahan;
  if not found then raise exception 'Bahan tidak ditemukan atau akses ditolak'; end if;
end $$;

-- Jadikan harga sekarang sebagai acuan perubahan modal.
create or replace function hpp_set_acuan() returns integer
language plpgsql set search_path = public as $$
declare n integer;
begin
  update hpp_bahan set harga_acuan = harga where harga_acuan is distinct from harga;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function hpp_ubah_harga(uuid, numeric, text, text) to authenticated;
grant execute on function hpp_set_acuan() to authenticated;
revoke execute on function hpp_ubah_harga(uuid, numeric, text, text) from public, anon;
revoke execute on function hpp_set_acuan() from public, anon;

-- ---------------------------------------------------------------------
-- RLS: hanya admin HPP. anon dicabut total.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['hpp_kategori','hpp_bahan','hpp_resep','hpp_resep_item','hpp_menu','hpp_menu_item','hpp_setting'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('drop policy if exists "hpp_admin_all_%s" on %I', t, t);
    execute format('create policy "hpp_admin_all_%s" on %I for all to authenticated using (hpp_is_admin()) with check (hpp_is_admin())', t, t);
  end loop;
end $$;

-- Riwayat: boleh dibaca admin, TIDAK boleh diubah/dihapus/ditambah langsung (hanya lewat trigger).
alter table hpp_harga_riwayat enable row level security;
revoke all on hpp_harga_riwayat from anon;
revoke insert, update, delete on hpp_harga_riwayat from authenticated;
drop policy if exists "hpp_admin_read_riwayat" on hpp_harga_riwayat;
create policy "hpp_admin_read_riwayat" on hpp_harga_riwayat for select to authenticated using (hpp_is_admin());

-- ---------------------------------------------------------------------
-- DAFTARKAN AKUN ADMIN HPP (jalankan SETELAH akunnya ada di Authentication -> Users).
-- Ganti email di bawah dengan email akun yang akan dipakai login di /hpp, lalu hilangkan tanda "--".
-- Boleh akun owner POS yang sudah ada (password: mamam: + PIN), atau akun baru khusus HPP.
--
-- insert into hpp_admin (user_id)
-- select id from auth.users where lower(email) = lower('GANTI-DENGAN-EMAIL-ANDA@contoh.com')
-- on conflict do nothing;
-- ---------------------------------------------------------------------
