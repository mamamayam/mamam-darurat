import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, rowToRecord, mergeRecords, fetchTable, run } from './ambil-a.mjs';

const ANON = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') + '.sig';
const SERVICE = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.sig';

const sale = (id, total, extra = {}) => ({ id, payload: { id, total, date: '2026-10-01T03:00:00.000Z', items: [{ name: 'Ayam', qty: 1, price: total }], ...extra }, deleted_at: null });

/** fetch palsu: meniru PostgREST (limit/offset) dan mencatat semua permintaan. */
function fakeA(tables) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), method: init?.method });
    const u = new URL(url);
    const table = decodeURIComponent(u.pathname.split('/').pop());
    if (!(table in tables)) return { ok: false, status: 404, json: async () => ({}) };
    const limit = Number(u.searchParams.get('limit')); const offset = Number(u.searchParams.get('offset'));
    return { ok: true, status: 200, json: async () => tables[table].slice(offset, offset + limit) };
  };
  return { impl, calls };
}

describe('rowToRecord', () => {
  it('menyatukan id baris, isi payload, dan kolom deleted_at', () => {
    expect(rowToRecord({ id: 'ORD-1', payload: { total: 5 }, deleted_at: '2026-10-02' })).toEqual({ total: 5, id: 'ORD-1', deletedAt: '2026-10-02' });
    expect(rowToRecord({ id: 'ORD-2', payload: { total: 5, deletedAt: 'x' }, deleted_at: null }).deletedAt).toBe('x');
    expect(rowToRecord({ id: 'ORD-3', payload: null }).deletedAt).toBeNull();
  });
});

describe('mergeRecords', () => {
  it('tidak menggandakan id yang sama dan menambah yang hanya ada di file', () => {
    const { rows, stats } = mergeRecords([{ id: 'a', total: 1 }, { id: 'b', total: 2 }], [{ id: 'b', total: 2 }, { id: 'c', total: 3 }]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(stats).toMatchObject({ dariSupabase: 2, hanyaDiFile: 1, keduanya: 1 });
  });
  it('Supabase dipakai, kolom kosong dilengkapi dari file, dan beda nilai dicatat', () => {
    const { rows, stats } = mergeRecords([{ id: 'a', total: 10, items: [], note: '' }], [{ id: 'a', total: 12, items: [{ n: 1 }], note: 'x' }]);
    expect(rows[0]).toMatchObject({ total: 10, items: [{ n: 1 }], note: 'x' });
    expect(stats.dilengkapi).toBe(1);
    expect(stats.bedaNilai).toHaveLength(1);
  });
  it('yang dihapus di salah satu sisi tetap dianggap dihapus', () => {
    const { rows } = mergeRecords([{ id: 'a', deletedAt: null }], [{ id: 'a', deletedAt: '2026-10-01' }]);
    expect(rows[0].deletedAt).toBe('2026-10-01');
  });
  it('baris tanpa id tidak dibuang dan tidak ikut dicek duplikat', () => {
    const { rows, stats } = mergeRecords([{ total: 1 }], [{ total: 2 }, { total: 2 }]);
    expect(rows).toHaveLength(2);   // 1 dari file x2 tanpa id (yang dari Supabase tanpa id dilewati)
    expect(stats.tanpaId).toBe(3);
  });
  it('tidak mengubah daftar masukan', () => {
    const f = [{ id: 'a', items: [] }]; const b = [{ id: 'a', items: [1] }];
    mergeRecords(f, b);
    expect(f[0].items).toEqual([]);
  });
});

describe('fetchTable', () => {
  it('mengambil semua halaman (1000 per halaman) dan hanya memakai GET', async () => {
    const rows = Array.from({ length: 2300 }, (_, i) => sale(`ORD-${i}`, 1));
    const { impl, calls } = fakeA({ salesHistory: rows });
    const got = await fetchTable({ url: 'https://a.supabase.co', key: ANON, table: 'salesHistory', fetchImpl: impl });
    expect(got).toHaveLength(2300);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it('melempar pesan jelas untuk 401 dan 404 tanpa membocorkan kunci', async () => {
    const f401 = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await expect(fetchTable({ url: 'https://a.supabase.co', key: ANON, table: 'customers', fetchImpl: f401 })).rejects.toThrow(/HTTP 401.*kunci/);
    const { impl } = fakeA({});
    const err = await fetchTable({ url: 'https://a.supabase.co', key: ANON, table: 'customers', fetchImpl: impl }).catch((e) => e);
    expect(err.message).toMatch(/HTTP 404/);
    expect(err.message).not.toContain(ANON);
  });
});

describe('parseArgs', () => {
  it('bawaan: hanya transaksi', () => expect(parseArgs([]).tabel).toEqual(['salesHistory']));
  it('menolak tabel/pilihan yang tidak dikenal', () => {
    expect(() => parseArgs(['--tabel', 'users'])).toThrow(/tidak dikenal/);
    expect(() => parseArgs(['--aneh'])).toThrow(/tidak dikenal/);
    expect(() => parseArgs(['--gabung'])).toThrow(/perlu nilai/);
    expect(parseArgs(['--lewati', 'a, b']).lewati).toEqual(['a', 'b']);
  });
});

describe('run', () => {
  let dir; let logs; const out = (s) => logs.push(s);
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ambil-a-')); logs = []; });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = (extra = '') => fs.writeFileSync(path.join(dir, '.env.local'), `A_SUPABASE_URL=https://aaaa.supabase.co\nA_SUPABASE_ANON_KEY=${ANON}\n${extra}`);

  it('mengambil, menggabung dengan file, dan menulis hasil tanpa mencetak kunci', async () => {
    env();
    fs.writeFileSync(path.join(dir, 'base.json'), JSON.stringify({ menus: [{ id: 'm1' }], salesHistory: [{ id: 'ORD-2', total: 20 }, { id: 'ORD-9', total: 90 }] }));
    const { impl } = fakeA({ salesHistory: [sale('ORD-1', 10), sale('ORD-2', 20)], customers: [{ id: 'CUST-1', payload: { name: 'Mila' }, deleted_at: null }] });
    const code = await run(['--gabung', 'base.json', '--keluar', 'hasil.json', '--tabel', 'salesHistory,customers'], { fetchImpl: impl, env: {}, cwd: dir, out });
    expect(code).toBe(0);
    const res = JSON.parse(fs.readFileSync(path.join(dir, 'hasil.json'), 'utf8'));
    expect(res.menus).toEqual([{ id: 'm1' }]);                              // bagian lain dari file gabung dipertahankan
    expect(res.salesHistory.map((r) => r.id).sort()).toEqual(['ORD-1', 'ORD-2', 'ORD-9']);
    expect(res.customers[0]).toMatchObject({ id: 'CUST-1', name: 'Mila' });
    const text = logs.join('\n');
    expect(text).toContain('PERHATIAN: 1 transaksi tidak punya rincian item');   // ORD-9 hanya ada di file, tanpa item
    expect(text).not.toContain(ANON);
  });
  it('memperingatkan kalau Supabase mengembalikan 0 baris (kemungkinan diblokir RLS)', async () => {
    env();
    const { impl } = fakeA({ salesHistory: [] });
    expect(await run(['--keluar', 'h.json'], { fetchImpl: impl, env: {}, cwd: dir, out })).toBe(0);
    expect(logs.join('\n')).toMatch(/0 baris.*RLS/);
  });
  it('--lewati membuang id tertentu dari Supabase dan dari file gabung', async () => {
    env();
    fs.writeFileSync(path.join(dir, 'base.json'), JSON.stringify({ salesHistory: [{ id: 'ORD-9', total: 9 }, { id: 'ORD-2', total: 20 }] }));
    const { impl } = fakeA({ salesHistory: [sale('ORD-1', 10), sale('ORD-2', 20), sale('ORD-3', 30)] });
    expect(await run(['--gabung', 'base.json', '--keluar', 'h.json', '--lewati', 'ORD-2, ORD-9'], { fetchImpl: impl, env: {}, cwd: dir, out })).toBe(0);
    const res = JSON.parse(fs.readFileSync(path.join(dir, 'h.json'), 'utf8'));
    expect(res.salesHistory.map((r) => r.id).sort()).toEqual(['ORD-1', 'ORD-3']);
  });
  it('menolak kunci rahasia dan alamat yang sama dengan project C', async () => {
    fs.writeFileSync(path.join(dir, '.env.local'), `A_SUPABASE_URL=https://aaaa.supabase.co\nA_SUPABASE_ANON_KEY=${SERVICE}\n`);
    expect(await run([], { fetchImpl: fakeA({}).impl, env: {}, cwd: dir, out })).toBe(1);
    expect(logs.join('\n')).toMatch(/RAHASIA/);
    logs = []; env('VITE_SUPABASE_URL=https://aaaa.supabase.co\n');
    expect(await run([], { fetchImpl: fakeA({}).impl, env: {}, cwd: dir, out })).toBe(1);
    expect(logs.join('\n')).toMatch(/sama dengan VITE_SUPABASE_URL/);
  });
  it('tidak menimpa file hasil yang sudah ada dan tidak menghubungi A sebelum itu', async () => {
    env(); fs.writeFileSync(path.join(dir, 'hasil.json'), 'lama');
    const { impl, calls } = fakeA({ salesHistory: [], customers: [] });
    expect(await run(['--keluar', 'hasil.json'], { fetchImpl: impl, env: {}, cwd: dir, out })).toBe(1);
    expect(fs.readFileSync(path.join(dir, 'hasil.json'), 'utf8')).toBe('lama');
    expect(calls).toHaveLength(0);
  });
  it('gagal dengan pesan jelas kalau env belum diisi, dan tidak menulis apa pun kalau pengambilan gagal', async () => {
    expect(await run([], { fetchImpl: fakeA({}).impl, env: {}, cwd: dir, out })).toBe(1);
    expect(logs.join('\n')).toMatch(/A_SUPABASE_URL/);
    env(); logs = [];
    expect(await run(['--keluar', 'x.json'], { fetchImpl: fakeA({}).impl, env: {}, cwd: dir, out })).toBe(1);   // tabel 404
    expect(fs.existsSync(path.join(dir, 'x.json'))).toBe(false);
  });
});
