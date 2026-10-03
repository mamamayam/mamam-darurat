-- =====================================================================
-- Migrasi 006 — Tutup periode gaji (angka gaji dibekukan).
-- Jalankan SEKALI di SQL Editor. Aman diulang.
--
-- Masalah yang diselesaikan: gaji dihitung ulang dari tarif karyawan SEKARANG,
-- jadi mengedit upah mengubah gaji periode lama. Dengan menutup periode, hasil
-- hitungan per karyawan DISIMPAN (termasuk tarif saat itu) dan dipakai seterusnya.
--
-- Dijaga di database, bukan hanya di layar:
--  * penutupan dilakukan SATU transaksi (close_payroll_period): periode + semua
--    barisnya masuk bersamaan, atau tidak sama sekali
--  * periode yang belum selesai tidak bisa ditutup
--  * tambahan/potongan bertanggal di dalam periode tertutup, dan saldo awal bulan
--    tertutup, TIDAK bisa ditambah/diubah/dihapus (ditolak oleh trigger)
--  * "Buka Kembali" = menghapus penutupan (baris ikut terhapus)
-- =====================================================================

create table if not exists payroll_closings (
  id            uuid primary key default gen_random_uuid(),
  period_type   text not null check (period_type in ('minggu','bulan')),
  period_start  date not null,
  period_end    date not null,
  note          text,
  closed_at     timestamptz not null default now(),
  check (period_end >= period_start),
  unique (period_start, period_end)
);

create table if not exists payroll_closing_lines (
  id                    uuid primary key default gen_random_uuid(),
  closing_id            uuid not null references payroll_closings(id) on delete cascade,
  employee_id           uuid references employees(id) on delete set null,   -- nama tetap ada di employee_name
  employee_name         text not null,
  employee_external_id  text,
  role                  text,
  net_pay               integer not null,
  gross_cost            integer not null,       -- upah kotor untuk Laba Rugi (tanpa kasbon)
  kasbon_total          integer not null default 0,
  rates_json            jsonb not null,         -- tarif saat ditutup: upah/jam, bonus FT, lembur/30 mnt
  payroll_json          jsonb not null          -- hasil hitung lengkap (rincian harian, tambahan, potongan)
);
create index if not exists idx_closing_lines_closing on payroll_closing_lines (closing_id);

create or replace function close_payroll_period(
  p_type text, p_start date, p_end date, p_today date, p_note text, p_lines jsonb
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  if p_type not in ('minggu','bulan') then raise exception 'Jenis periode tidak valid'; end if;
  if p_end < p_start then raise exception 'Periode tidak valid'; end if;
  if p_end >= p_today then raise exception 'Periode belum selesai, belum bisa ditutup'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Tidak ada data gaji untuk ditutup';
  end if;

  insert into payroll_closings (period_type, period_start, period_end, note)
  values (p_type, p_start, p_end, nullif(trim(p_note), ''))
  returning id into v_id;

  insert into payroll_closing_lines
    (closing_id, employee_id, employee_name, employee_external_id, role, net_pay, gross_cost, kasbon_total, rates_json, payroll_json)
  select v_id, nullif(l->>'employee_id','')::uuid, l->>'employee_name', nullif(l->>'employee_external_id',''), l->>'role',
         (l->>'net_pay')::integer, (l->>'gross_cost')::integer, coalesce((l->>'kasbon_total')::integer, 0),
         l->'rates_json', l->'payroll_json'
  from jsonb_array_elements(p_lines) l;

  return v_id;
end $$;

-- Tambahan/potongan di periode tertutup tidak boleh berubah.
create or replace function block_closed_payroll_change() returns trigger language plpgsql as $$
declare d date;
begin
  foreach d in array array[
    case when tg_op in ('UPDATE','DELETE') then old.date end,
    case when tg_op in ('INSERT','UPDATE') then new.date end
  ] loop
    if d is not null and exists (select 1 from payroll_closings c where d between c.period_start and c.period_end) then
      raise exception 'Periode gaji ini sudah ditutup, jadi tambahan/potongan tidak bisa diubah. Buka kembali periodenya dulu kalau perlu koreksi.';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Saldo awal bulan yang sudah ditutup (penutupan jenis 'bulan') tidak boleh berubah.
create or replace function block_closed_opening_balance_change() returns trigger language plpgsql as $$
declare m text;
begin
  foreach m in array array[
    case when tg_op in ('UPDATE','DELETE') then old.month end,
    case when tg_op in ('INSERT','UPDATE') then new.month end
  ] loop
    if m is not null and exists (select 1 from payroll_closings c where c.period_type = 'bulan' and to_char(c.period_start, 'YYYY-MM') = m) then
      raise exception 'Bulan gaji ini sudah ditutup, jadi saldo awal tidak bisa diubah. Buka kembali periodenya dulu kalau perlu koreksi.';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_block_closed_additions on payroll_additions;
create trigger trg_block_closed_additions before insert or update or delete on payroll_additions
  for each row execute function block_closed_payroll_change();
drop trigger if exists trg_block_closed_deductions on payroll_deductions;
create trigger trg_block_closed_deductions before insert or update or delete on payroll_deductions
  for each row execute function block_closed_payroll_change();
drop trigger if exists trg_block_closed_opening on payroll_opening_balances;
create trigger trg_block_closed_opening before insert or update or delete on payroll_opening_balances
  for each row execute function block_closed_opening_balance_change();

grant execute on function close_payroll_period(text, date, date, date, text, jsonb) to anon;

do $$
declare t text;
begin
  foreach t in array array['payroll_closings','payroll_closing_lines'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon_all_%s" on %I', t, t);
    execute format('create policy "anon_all_%s" on %I for all to anon using (true) with check (true)', t, t);
  end loop;
end $$;
