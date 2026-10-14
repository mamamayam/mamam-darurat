import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const sql = (nama) => fs.readFileSync(fileURLToPath(new URL(`../../supabase/migrations/${nama}`, import.meta.url)), 'utf8');
const skema = sql('013_hpp.sql');
const seed = sql('014_hpp_data_awal.sql');

describe('013_hpp.sql — keamanan', () => {
  const tabel = [...skema.matchAll(/create table if not exists (hpp_\w+)/g)].map((m) => m[1]);

  it('semua tabel HPP punya RLS (eksplisit atau lewat loop daftar tabel)', () => {
    expect(tabel).toHaveLength(9);
    for (const t of tabel) {
      const eksplisit = new RegExp(`alter table ${t} enable row level security`).test(skema);
      const lewatLoop = new RegExp(`array\\[[^\\]]*'${t}'`).test(skema);
      expect(eksplisit || lewatLoop, `RLS ${t}`).toBe(true);
    }
  });
  it('anon dicabut dari semua tabel HPP dan tidak ada policy untuk anon', () => {
    expect(skema).toMatch(/revoke all on %I from anon/);
    expect(skema).toMatch(/revoke all on hpp_harga_riwayat from anon/);
    expect(skema).not.toMatch(/to anon/i);
    expect(skema).not.toMatch(/using \(true\)/i);
    expect(skema).not.toMatch(/with check \(true\)/i);
  });
  it('akses hanya lewat hpp_is_admin(); hpp_admin tidak bisa dibaca langsung', () => {
    expect(skema).toMatch(/create or replace function hpp_is_admin\(\)[\s\S]*security definer/);
    expect(skema).toMatch(/revoke all on hpp_admin from anon, authenticated/);
    expect(skema.match(/using \(hpp_is_admin\(\)\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it('riwayat harga tidak bisa ditambah/diubah/dihapus langsung', () => {
    expect(skema).toMatch(/revoke insert, update, delete on hpp_harga_riwayat from authenticated/);
    expect(skema).not.toMatch(/create policy "hpp_admin_[a-z_]*riwayat" on hpp_harga_riwayat for (all|insert|update|delete)/);
  });
  it('akun admin tidak didaftarkan otomatis (baris contoh tetap berupa komentar)', () => {
    const aktif = skema.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(aktif).not.toMatch(/insert into hpp_admin/i);
  });
});

describe('014_hpp_data_awal.sql — data awal', () => {
  const baris = seed.split('\n').filter((l) => /^insert into/i.test(l));
  it('berisi data HPP dan tidak mengandung kontak pelanggan', () => {
    expect(baris.length).toBeGreaterThan(300);
    expect(seed).not.toMatch(/\b(\+62|62|0)8[0-9]{8,11}\b/);   // nomor HP Indonesia
    expect(seed).not.toMatch(/Kak |Kontak/);
  });
  it('aman diulang: setiap insert memakai ON CONFLICT DO NOTHING', () => {
    expect(baris.every((l) => /on conflict do nothing;\s*$/i.test(l))).toBe(true);
  });
  it('hanya menyentuh tabel hpp_*', () => {
    for (const l of baris) expect(l).toMatch(/^insert into hpp_/i);
  });
});
