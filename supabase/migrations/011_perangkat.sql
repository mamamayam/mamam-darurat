-- =====================================================================
-- Migrasi 011 — Perangkat terdaftar (pelacakan HP yang mencatat transaksi).
-- Jalankan SEKALI di SQL Editor project C SEBELUM aplikasi versi ini
-- dipasang. Aman diulang. Butuh migrasi 008 (tabel app_settings).
--
-- 1. devices            : HP yang pernah membuka aplikasi. Owner memberi nama
--                         (status terdaftar) atau mencabut aksesnya.
-- 2. transactions / expenses : kolom device_id + device_name (nama saat dicatat).
-- 3. Trigger stamp_perangkat : mengisi device_name; kalau kunci server aktif
--                         (app_settings.device_enforce = true), penulisan dari
--                         HP yang belum terdaftar DITOLAK.
-- 4. catat_potongan     : menerima p_device_id (pengeluaran karyawan ikut tercatat
--                         dari HP mana).
--
-- Kunci server MATI saat migrasi (device_enforce = false) supaya tidak ada HP
-- yang tiba-tiba gagal menyimpan. Nyalakan di Pengaturan > Perangkat setelah
-- semua HP didaftarkan. Layar kunci HP staf di aplikasi aktif tanpa menunggu itu.
-- Ini pagar pencatatan (jejak audit), bukan keamanan data: RLS tetap longgar.
-- =====================================================================

create table if not exists devices (
  id            uuid primary key,                       -- dibuat di HP (localStorage), bukan ID perangkat keras
  code          text not null,                          -- kode pendek untuk mencocokkan HP saat owner memberi nama
  name          text,
  status        text not null default 'menunggu' check (status in ('menunggu', 'terdaftar', 'dicabut')),
  user_agent    text,
  created_at    timestamptz not null default now(),
  registered_at timestamptz,
  last_seen_at  timestamptz
);

-- Tanpa FK: device_id hanya penanda; nama disalin ke device_name supaya riwayat tetap terbaca walau HP dihapus.
alter table transactions add column if not exists device_id   uuid;
alter table transactions add column if not exists device_name text;
alter table expenses     add column if not exists device_id   uuid;
alter table expenses     add column if not exists device_name text;
create index if not exists idx_transactions_device on transactions (device_id);
create index if not exists idx_expenses_device     on expenses (device_id);

insert into app_settings (key, value) values ('device_enforce', 'false'::jsonb) on conflict (key) do nothing;

alter table devices enable row level security;
drop policy if exists "anon_all_devices" on devices;
create policy "anon_all_devices" on devices for all to anon using (true) with check (true);
drop policy if exists "auth_all_devices" on devices;
create policy "auth_all_devices" on devices for all to authenticated using (true) with check (true);

create or replace function stamp_perangkat() returns trigger language plpgsql as $$
declare
  d devices%rowtype;
  v_enforce boolean;
begin
  select coalesce((select value <> 'false'::jsonb from app_settings where key = 'device_enforce'), false) into v_enforce;
  if new.device_id is not null then
    select * into d from devices where id = new.device_id;
  end if;
  if v_enforce and (d.id is null or d.status <> 'terdaftar') then
    raise exception 'Perangkat ini belum terdaftar. Minta owner mendaftarkannya di Pengaturan, Perangkat.';
  end if;
  new.device_name := d.name;   -- sengaja menimpa kiriman klien
  return new;
end $$;

drop trigger if exists trg_stamp_perangkat on transactions;
create trigger trg_stamp_perangkat before insert on transactions for each row execute function stamp_perangkat();
drop trigger if exists trg_stamp_perangkat on expenses;
create trigger trg_stamp_perangkat before insert on expenses for each row execute function stamp_perangkat();

-- catat_potongan: tambah p_device_id (default null). Fungsi lama (6 argumen) dihapus
-- supaya PostgREST tidak bingung memilih antara dua versi.
drop function if exists catat_potongan(uuid, text, integer, date, text, text);
create or replace function catat_potongan(
  p_employee_id uuid, p_label text, p_amount integer, p_date date, p_category text, p_payment_method text,
  p_device_id uuid default null
) returns uuid language plpgsql as $$
declare
  v_name text; v_cat text; v_label text; v_pay text; v_expense uuid; v_deduction uuid;
begin
  select name into v_name from employees where id = p_employee_id;
  if v_name is null then raise exception 'Karyawan tidak ditemukan'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  v_cat := nullif(trim(p_category), '');
  if v_cat is null then raise exception 'Kategori wajib diisi'; end if;
  v_label := coalesce(nullif(trim(p_label), ''), v_cat);
  v_pay := case when p_payment_method = 'Non-Tunai' then 'Non-Tunai' else 'Tunai' end;

  insert into expenses (direction, category, amount, transaction_date, store_or_supplier_name, detail, payment_method, employee_id, employee_name, device_id)
  values ('pengeluaran', v_cat, p_amount, p_date, v_name, v_label, v_pay, p_employee_id, v_name, p_device_id)
  returning id into v_expense;

  insert into payroll_deductions (employee_id, label, amount, date, category, expense_id)
  values (p_employee_id, v_label, p_amount, p_date, v_cat, v_expense)
  returning id into v_deduction;

  return v_deduction;
end $$;

grant execute on function catat_potongan(uuid, text, integer, date, text, text, uuid) to anon;
grant execute on function catat_potongan(uuid, text, integer, date, text, text, uuid) to authenticated;
