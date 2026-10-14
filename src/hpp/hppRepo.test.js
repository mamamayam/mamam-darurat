import { describe, it, expect } from 'vitest';
import * as repo from './hppRepo';

/** Klien Supabase palsu: mencatat setiap permintaan; `jawab(st)` menentukan hasilnya. */
function fakeDb(jawab) {
  const calls = [];
  const from = (tabel) => {
    const st = { tabel, op: 'select', order: [], eq: null, range: null, v: null, opsi: null, pilih: false };
    const api = {
      select() { st.pilih = true; return api; },
      order(k, o) { st.order.push([k, o.ascending]); return api; },
      range(a, b) { st.range = [a, b]; return api; },
      insert(v) { st.op = 'insert'; st.v = v; return api; },
      update(v) { st.op = 'update'; st.v = v; return api; },
      delete() { st.op = 'delete'; return api; },
      upsert(v, o) { st.op = 'upsert'; st.v = v; st.opsi = o; return api; },
      eq(k, v) { st.eq = [k, v]; return api; },
      then(res, rej) { calls.push(st); return Promise.resolve(jawab(st)).then(res, rej); },
    };
    return api;
  };
  const rpc = (nama, args) => { const st = { rpc: nama, args }; calls.push(st); return Promise.resolve(jawab(st)); };
  return { from, rpc, calls };
}
const sukses = (data = null) => ({ data, error: null });

describe('explainError', () => {
  it('tabel belum ada -> petunjuk memasang SQL', () => {
    expect(repo.explainError({ code: 'PGRST205', message: 'Could not find the table' })).toMatchObject({ setup: true });
    expect(repo.explainError({ message: 'relation "hpp_bahan" does not exist' }).setup).toBe(true);
  });
  it('tidak punya akses, duplikat, masih dipakai, jaringan', () => {
    expect(repo.explainError({ code: '42501', message: 'x' }).pesan).toMatch(/hpp_admin/);
    expect(repo.explainError({ code: '23505' }).pesan).toMatch(/sudah dipakai/);
    expect(repo.explainError({ code: '23503' }).pesan).toMatch(/Masih dipakai/);
    expect(repo.explainError(new TypeError('Failed to fetch')).pesan).toMatch(/internet/);
    expect(repo.explainError({ message: 'lain' }).pesan).toBe('lain');
  });
});

describe('loadAll', () => {
  it('memuat 8 tabel; tabel besar diambil per halaman 1000 baris', async () => {
    const besar = Array.from({ length: 2300 }, (_, i) => ({ id: i }));
    const db = fakeDb((st) => sukses(st.tabel === 'hpp_harga_riwayat' ? besar.slice(st.range[0], st.range[1] + 1) : [{ id: 'x' }]));
    const hasil = await repo.loadAll(db);
    expect(Object.keys(hasil).sort()).toEqual(['bahan', 'kategori', 'menu', 'menuItem', 'resep', 'resepItem', 'riwayat', 'setting']);
    expect(hasil.riwayat).toHaveLength(2300);
    expect(db.calls.filter((c) => c.tabel === 'hpp_harga_riwayat')).toHaveLength(3);
    expect(db.calls.filter((c) => c.tabel === 'hpp_bahan')).toHaveLength(1);
  });
  it('riwayat diurutkan terbaru dulu', async () => {
    const db = fakeDb(() => sukses([]));
    await repo.loadAll(db);
    expect(db.calls.find((c) => c.tabel === 'hpp_harga_riwayat').order[0]).toEqual(['dibuat_pada', false]);
  });
  it('kesalahan database dilempar sebagai Error berpesan Indonesia', async () => {
    const db = fakeDb(() => ({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }));
    await expect(repo.loadAll(db)).rejects.toThrow(/belum dipasang/);
  });
});

describe('mutasi', () => {
  it('ubahHarga memanggil RPC hpp_ubah_harga dengan argumen benar (catatan kosong jadi null)', async () => {
    const db = fakeDb(() => sukses());
    await repo.ubahHarga(db, { bahanId: 'b1', harga: 60000, catatan: '', sumber: 'manual' });
    await repo.ubahHarga(db, { bahanId: 'b1', harga: 61000, catatan: 'Naik', sumber: 'modal_menu' });
    expect(db.calls[0]).toEqual({ rpc: 'hpp_ubah_harga', args: { p_bahan: 'b1', p_harga: 60000, p_catatan: null, p_sumber: 'manual' } });
    expect(db.calls[1].args).toMatchObject({ p_catatan: 'Naik', p_sumber: 'modal_menu' });
  });
  it('ubahHarga menolak diam-diam? Tidak: kesalahan RPC dilempar', async () => {
    const db = fakeDb(() => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    await expect(repo.ubahHarga(db, { bahanId: 'b1', harga: 1 })).rejects.toThrow(/hpp_admin/);
  });
  it('setAcuan, ubahBahan, ubahMenu, kategori, setting', async () => {
    const db = fakeDb((st) => (st.op === 'insert' ? sukses([{ id: 'baru', ...st.v }]) : sukses(3)));
    expect(await repo.setAcuan(db)).toBe(3);
    await repo.ubahBahan(db, 'b1', { kategori_id: 'k' });
    await repo.ubahMenu(db, 'm1', { harga_outlet: 21000 });
    const k = await repo.tambahKategori(db, { jenis: 'bahan', nama: 'Bumbu', urutan: 6 });
    await repo.ubahKategori(db, 'k', { nama: 'Baru' });
    await repo.hapusKategori(db, 'k');
    await repo.simpanSetting(db, 'margin', { lo: 25, hi: 30 });
    expect(k).toMatchObject({ id: 'baru', nama: 'Bumbu' });
    const c = db.calls;
    expect(c[0].rpc).toBe('hpp_set_acuan');
    expect(c[1]).toMatchObject({ tabel: 'hpp_bahan', op: 'update', v: { kategori_id: 'k' }, eq: ['id', 'b1'] });
    expect(c[2]).toMatchObject({ tabel: 'hpp_menu', op: 'update', eq: ['id', 'm1'] });
    expect(c[5]).toMatchObject({ tabel: 'hpp_kategori', op: 'delete', eq: ['id', 'k'] });
    expect(c[6]).toMatchObject({ tabel: 'hpp_setting', op: 'upsert', opsi: { onConflict: 'key' } });
    expect(c[6].v).toMatchObject({ key: 'margin', value: { lo: 25, hi: 30 } });
  });
});
