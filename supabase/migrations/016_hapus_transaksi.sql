-- =====================================================================
-- Migrasi 016 — Pengajuan hapus transaksi (staf mengajukan, owner memutuskan).
-- Jalankan SEKALI di SQL Editor project C. Aman diulang. Tidak butuh migrasi lain.
--
-- 1. transaction_delete_requests : satu baris per pengajuan. Menyimpan SNAPSHOT transaksi
--    (nomor, total, pelanggan, item) karena transaksinya hilang kalau disetujui, tapi
--    catatan siapa-minta-apa-kenapa harus tetap ada. transaction_id sengaja TANPA FK.
-- 2. ajukan_hapus_transaksi()    : staf mengajukan (alasan + nama wajib). Satu transaksi
--    hanya boleh punya SATU pengajuan 'menunggu'.
-- 3. putuskan_hapus_transaksi()  : owner setuju (transaksi + item dihapus permanen, dalam
--    SATU transaksi database) atau tolak (transaksi tetap).
-- 4. Trigger: kalau transaksi dihapus langsung oleh owner dari Riwayat, pengajuan 'menunggu'
--    miliknya otomatis jadi 'disetujui' (tidak menggantung selamanya di daftar Persetujuan).
--
-- Ini pagar alur kerja (jejak audit), bukan keamanan data: RLS tetap longgar seperti tabel lain.
-- =====================================================================

create table if not exists transaction_delete_requests (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null,                       -- tanpa FK: catatan tetap ada setelah transaksi dihapus
  display_number  text,                                -- snapshot
  customer_name   text,
  order_type      text,
  payment_method  text,
  total           integer,
  transaction_at  timestamptz,                         -- paid_at / created_at transaksi
  items_summary   text,                                -- "2x Ayam Geprek, 1x Es Teh"
  reason          text not null,
  requested_by    text not null,
  device_id       uuid,
  status          text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  reject_reason   text,
  decided_by      text,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_tdr_status on transaction_delete_requests (status, created_at);
create index if not exists idx_tdr_transaction on transaction_delete_requests (transaction_id);
-- Satu transaksi = paling banyak satu pengajuan yang masih menunggu.
create unique index if not exists uq_tdr_pending on transaction_delete_requests (transaction_id) where status = 'menunggu';

alter table transaction_delete_requests enable row level security;
drop policy if exists "anon_all_transaction_delete_requests" on transaction_delete_requests;
create policy "anon_all_transaction_delete_requests" on transaction_delete_requests for all to anon using (true) with check (true);
drop policy if exists "auth_all_transaction_delete_requests" on transaction_delete_requests;
create policy "auth_all_transaction_delete_requests" on transaction_delete_requests for all to authenticated using (true) with check (true);

create or replace function ajukan_hapus_transaksi(
  p_transaction_id uuid, p_reason text, p_requested_by text, p_device_id uuid default null
) returns uuid language plpgsql as $$
declare
  t transactions%rowtype;
  v_reason text := nullif(trim(p_reason), '');
  v_by text := nullif(trim(p_requested_by), '');
  v_items text;
  v_id uuid;
begin
  if v_reason is null then raise exception 'Alasan wajib diisi'; end if;
  if v_by is null then raise exception 'Pilih namamu dulu'; end if;
  select * into t from transactions where id = p_transaction_id;
  if t.id is null then raise exception 'Transaksi ini sudah tidak ada'; end if;
  if exists (select 1 from transaction_delete_requests where transaction_id = p_transaction_id and status = 'menunggu') then
    raise exception 'Transaksi ini sudah diajukan untuk dihapus, tunggu keputusan owner';
  end if;

  select string_agg(qty || 'x ' || name, ', ' order by name) into v_items from transaction_items where transaction_id = p_transaction_id;

  insert into transaction_delete_requests (transaction_id, display_number, customer_name, order_type, payment_method, total, transaction_at, items_summary, reason, requested_by, device_id)
  values (t.id, t.display_number, t.customer_name, t.order_type, t.payment_method, t.total, coalesce(t.paid_at, t.created_at), v_items, v_reason, v_by, p_device_id)
  returning id into v_id;
  return v_id;
end $$;

-- Mengembalikan status akhir ('disetujui' | 'ditolak'). Pengajuan yang sudah diputuskan ditolak dengan pesan jelas.
create or replace function putuskan_hapus_transaksi(
  p_request_id uuid, p_approve boolean, p_reason text default null
) returns text language plpgsql as $$
declare
  r transaction_delete_requests%rowtype;
begin
  select * into r from transaction_delete_requests where id = p_request_id for update;
  if r.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if r.status <> 'menunggu' then raise exception 'Pengajuan ini sudah diputuskan sebelumnya'; end if;

  if p_approve then
    delete from transactions where id = r.transaction_id;   -- item ikut terhapus (ON DELETE CASCADE); trigger di bawah menandai 'disetujui'
    update transaction_delete_requests set status = 'disetujui', decided_by = 'Owner', decided_at = now(), reject_reason = null where id = r.id;
    return 'disetujui';
  end if;
  update transaction_delete_requests set status = 'ditolak', decided_by = 'Owner', decided_at = now(), reject_reason = nullif(trim(p_reason), '') where id = r.id;
  return 'ditolak';
end $$;

-- Transaksi dihapus langsung (owner dari Riwayat / hapus banyak): pengajuan yang menunggu dianggap selesai.
create or replace function selesaikan_pengajuan_hapus() returns trigger language plpgsql as $$
begin
  update transaction_delete_requests
     set status = 'disetujui', decided_by = 'Owner', decided_at = now()
   where transaction_id = old.id and status = 'menunggu';
  return old;
end $$;

drop trigger if exists trg_selesaikan_pengajuan_hapus on transactions;
create trigger trg_selesaikan_pengajuan_hapus after delete on transactions for each row execute function selesaikan_pengajuan_hapus();

grant execute on function ajukan_hapus_transaksi(uuid, text, text, uuid) to anon;
grant execute on function ajukan_hapus_transaksi(uuid, text, text, uuid) to authenticated;
grant execute on function putuskan_hapus_transaksi(uuid, boolean, text) to anon;
grant execute on function putuskan_hapus_transaksi(uuid, boolean, text) to authenticated;
