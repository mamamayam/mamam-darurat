import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, parseArgs, parseEnv, openShiftWarning } from './cli.mjs';
import { createClient, ApiError } from './postgrest.mjs';
import { buildPlan } from './transform.mjs';
import { makeBackup } from './fixture.mjs';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role })}.sig`;
const ANON = jwt('anon');
const HOST = 'abcdwxyz.supabase.co';
const URL_C = `https://${HOST}`;

const PK = { menu_item_variant_groups: ['menu_item_id', 'variant_group_id'] };
const pkOf = (t) => PK[t] ?? ['id'];

/** Supabase tiruan di memori: cukup untuk GET berhalaman, POST ignore-duplicates, DELETE in(). */
function fakeSupabase({ seed = {}, failPostAt = null, key = ANON } = {}) {
  const tables = {};
  for (const [t, rows] of Object.entries(seed)) tables[t] = rows.map((r) => ({ ...r }));
  const calls = [];
  let posts = 0;
  const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const table = /\/rest\/v1\/([a-z_]+)$/.exec(u.pathname)[1];
    const method = init.method || 'GET';
    calls.push({ method, table, search: u.search, host: u.host });
    if (init.headers?.apikey !== key) return reply(401, { message: 'Invalid API key' });
    tables[table] ||= [];
    if (method === 'GET') {
      const cols = u.searchParams.get('select').split(',');
      const off = Number(u.searchParams.get('offset')); const lim = Number(u.searchParams.get('limit'));
      return reply(200, tables[table].slice(off, off + lim).map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null]))));
    }
    if (method === 'POST') {
      posts += 1;
      if (failPostAt !== null && posts === failPostAt) return reply(409, { message: 'duplicate key value violates unique constraint "boom"' });
      const cols = pkOf(table);
      const ignore = /resolution=ignore-duplicates/.test(init.headers?.Prefer ?? '') && u.searchParams.get('on_conflict') === cols.join(',');
      for (const row of JSON.parse(init.body)) {
        const dup = tables[table].some((r) => cols.every((c) => r[c] === row[c]));
        if (dup && !ignore) return reply(409, { message: `duplicate key value violates unique constraint "${table}_pkey"` });
        if (!dup) tables[table].push({ ...row });
      }
      return reply(201);
    }
    if (method === 'DELETE') {
      const [col, val] = [...u.searchParams.entries()][0];
      const ids = new Set(/^in\.\((.*)\)$/.exec(val)[1].split(','));
      tables[table] = tables[table].filter((r) => !ids.has(r[col]));
      return reply(204);
    }
    return reply(405, { message: 'method' });
  };
  return { fetchImpl, tables, calls, posts: () => posts, writes: () => calls.filter((c) => c.method !== 'GET') };
}

const dirs = [];
afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true }); });

function project({ env, backup = makeBackup(), backupRaw } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrasi-'));
  dirs.push(dir);
  if (env !== null) fs.writeFileSync(path.join(dir, '.env.local'), env ?? `VITE_SUPABASE_URL=${URL_C}\nVITE_SUPABASE_ANON_KEY=${ANON}\n`);
  fs.writeFileSync(path.join(dir, 'backup.json'), backupRaw ?? JSON.stringify(backup));
  return dir;
}
async function go(dir, args, fake, extra = {}) {
  const out = [];
  const code = await run(args, { cwd: dir, log: (s = '') => out.push(String(s)), fetchImpl: fake?.fetchImpl, now: () => new Date('2026-10-04T08:30:15.000Z'), ...extra });
  return { code, text: out.join('\n') };
}
const rows = (fake, t) => fake.tables[t] ?? [];

describe('argumen & env', () => {
  it('parseArgs: bendera dikenali; path dengan spasi tetap satu argumen; argumen asing ditolak', () => {
    expect(parseArgs(['C:\\Dok Baru\\b.json', '--apply', '--riwayat'])).toMatchObject({ file: 'C:\\Dok Baru\\b.json', apply: true, riwayat: true });
    expect(parseArgs(['--batalkan', 'log.json']).undoFile).toBe('log.json');
    expect(() => parseArgs(['a.json', '--aply'])).toThrow(/tidak dikenal/);
    expect(() => parseArgs(['a.json', 'b.json'])).toThrow(/berlebih/);
    expect(() => parseArgs(['--batalkan'])).toThrow(/berkas log/);
  });
  it('parseEnv: BOM, CRLF, kutip, komentar, export', () => {
    expect(parseEnv('\uFEFF# c\r\nexport A="x y"\r\nB=2 # k\r\nC=\'q\'\r\n')).toEqual({ A: 'x y', B: '2', C: 'q' });
  });
  it('tanpa argumen / --help menampilkan bantuan', async () => {
    const a = await go(project(), ['--help'], fakeSupabase()); expect(a.code).toBe(0); expect(a.text).toMatch(/--apply/);
    const b = await go(project(), [], fakeSupabase()); expect(b.code).toBe(1); expect(b.text).toMatch(/Langkah/);
  });
});

describe('simulasi (bawaan)', () => {
  it('membaca C tapi TIDAK menulis apa pun; laporan jelas; kunci & alamat lengkap tidak tercetak', async () => {
    const fake = fakeSupabase(); const dir = project();
    const r = await go(dir, ['backup.json'], fake);
    expect(r.code).toBe(0);
    expect(fake.writes()).toEqual([]);
    expect(fs.readdirSync(dir).filter((f) => f.startsWith('migrasi-log'))).toEqual([]);
    expect(r.text).toMatch(/SIMULASI/); expect(r.text).toMatch(/Menu\s+5\s+0/); expect(r.text).toMatch(/belum ada yang ditulis/);
    expect(r.text).toMatch(/Dilewati/); expect(r.text).toMatch(/Poin pelanggan/);
    expect(r.text).not.toContain(ANON); expect(r.text).not.toContain(HOST);
    expect(r.text).not.toMatch(/Transaksi\s+\d/);                 // tanpa --riwayat
  });
  it('--riwayat menambahkan transaksi, pengeluaran, dan shift ke laporan', async () => {
    const r = await go(project(), ['backup.json', '--riwayat'], fakeSupabase());
    expect(r.text).toMatch(/Transaksi\s+4\s+0/); expect(r.text).toMatch(/Item transaksi\s+5/); expect(r.text).toMatch(/Shift \(riwayat\)\s+1/);
  });
  it('tanpa .env.local: simulasi tetap jalan (offline) dengan peringatan; menulis ditolak', async () => {
    const dir = project({ env: null });
    const sim = await go(dir, ['backup.json'], fakeSupabase());
    expect(sim.code).toBe(0); expect(sim.text).toMatch(/\.env\.local tidak ditemukan/);
    const apply = await go(dir, ['backup.json', '--apply'], fakeSupabase());
    expect(apply.code).toBe(1); expect(apply.text).toMatch(/Tidak bisa menulis/);
  });
  it('halaman data besar dibaca tuntas (lebih dari 1000 baris per tabel)', async () => {
    const seed = { customers: Array.from({ length: 1100 }, (_, i) => ({ id: `u${i}`, name: `P${i}`, phone: `08${String(i).padStart(9, '0')}` })) };
    const fake = fakeSupabase({ seed });
    const r = await go(project(), ['backup.json'], fake);
    expect(r.code).toBe(0);
    expect(fake.calls.some((c) => c.table === 'customers' && c.search.includes('offset=1000'))).toBe(true);
  });
});

describe('menulis (--apply)', () => {
  it('menulis semua tabel, mencatat log, lalu menjalankan lagi tidak menulis apa pun (idempoten)', async () => {
    const fake = fakeSupabase(); const dir = project();
    const first = await go(dir, ['backup.json', '--riwayat', '--apply'], fake);
    expect(first.code).toBe(0); expect(first.text).toMatch(/Selesai\. \d+ baris ditulis/);
    expect(rows(fake, 'menu_items')).toHaveLength(5); expect(rows(fake, 'transactions')).toHaveLength(4); expect(rows(fake, 'transaction_items')).toHaveLength(5);
    expect(rows(fake, 'shifts')).toHaveLength(1); expect(rows(fake, 'expenses')).toHaveLength(5);
    const logs = fs.readdirSync(dir).filter((f) => f.startsWith('migrasi-log-'));
    expect(logs).toEqual(['migrasi-log-20261004-083015.json']);
    const log = JSON.parse(fs.readFileSync(path.join(dir, logs[0]), 'utf8'));
    expect(log.tables.menu_items).toHaveLength(5); expect(log.host).not.toBe(HOST);

    const before = fake.writes().length;
    const again = await go(dir, ['backup.json', '--riwayat', '--apply'], fake);
    expect(again.code).toBe(0); expect(again.text).toMatch(/semuanya sudah ada/);
    expect(fake.writes().length).toBe(before);
    expect(rows(fake, 'menu_items')).toHaveLength(5);
  });

  it('data C yang sudah ada TIDAK ditimpa', async () => {
    const seed = { categories: [{ id: 'c-ada', name: 'ayam geprek', sort_order: 9 }], menu_items: [{ id: 'm-ada', category_id: 'c-ada', name: 'Ayam Geprek', price: 99999 }] };
    const fake = fakeSupabase({ seed });
    const r = await go(project(), ['backup.json', '--apply'], fake);
    expect(r.code).toBe(0);
    expect(rows(fake, 'categories').find((c) => c.id === 'c-ada')).toMatchObject({ name: 'ayam geprek', sort_order: 9 });
    expect(rows(fake, 'menu_items').find((m) => m.id === 'm-ada').price).toBe(99999);
    expect(rows(fake, 'menu_items').filter((m) => m.name.toLowerCase() === 'ayam geprek')).toHaveLength(1);
  });

  it('gagal di tengah jalan: yang sudah masuk dicatat, pesan jelas, dan menjalankan ulang MELANJUTKAN tanpa data ganda', async () => {
    const fake = fakeSupabase({ failPostAt: 4 }); const dir = project();
    const r1 = await go(dir, ['backup.json', '--riwayat', '--apply'], fake);
    expect(r1.code).toBe(1); expect(r1.text).toMatch(/Berhenti di tengah jalan/); expect(r1.text).toMatch(/aman/);
    const partial = fs.readdirSync(dir).find((f) => f.startsWith('migrasi-log-'));
    expect(partial).toBeTruthy();
    const logged = JSON.parse(fs.readFileSync(path.join(dir, partial), 'utf8')).tables;
    expect(Object.keys(logged).length).toBeGreaterThan(0);
    for (const [t, ids] of Object.entries(logged)) if (typeof ids[0] === 'string') expect(ids).toEqual(rows(fake, t).map((x) => x.id));   // log = persis yang tertulis

    const r2 = await go(dir, ['backup.json', '--riwayat', '--apply'], fake);
    expect(r2.code).toBe(0);
    const clean = fakeSupabase(); await go(project(), ['backup.json', '--riwayat', '--apply'], clean);
    for (const t of Object.keys(clean.tables)) expect(rows(fake, t).length, t).toBe(rows(clean, t).length);   // sama persis dengan sekali jalan mulus
  });

  it('kunci salah (401): berhenti dengan petunjuk, tanpa menulis', async () => {
    const fake = fakeSupabase({ key: 'kunci-lain' });
    const r = await go(project(), ['backup.json', '--apply'], fake);
    expect(r.code).toBe(1); expect(r.text).toMatch(/VITE_SUPABASE_ANON_KEY/); expect(fake.writes()).toEqual([]);
  });

  it('peringatan kalau data lama lebih baru dari shift yang sedang terbuka di C', async () => {
    const plan = buildPlan(makeBackup(), {}, { withHistory: true });
    expect(openShiftWarning(plan, [{ id: 's', opened_at: '2026-10-03T00:00:00Z', closed_at: null }])).toMatch(/LEBIH BARU/);
    expect(openShiftWarning(plan, [{ id: 's', opened_at: '2027-01-01T00:00:00Z', closed_at: null }])).toBeNull();
    expect(openShiftWarning(plan, [{ id: 's', opened_at: '2026-10-03T00:00:00Z', closed_at: '2026-10-03T10:00:00Z' }])).toBeNull();
    expect(openShiftWarning(plan, [])).toBeNull();
  });
});

describe('pengaman', () => {
  it('menolak kunci RAHASIA (service_role) di .env.local', async () => {
    const dir = project({ env: `VITE_SUPABASE_URL=${URL_C}\nVITE_SUPABASE_ANON_KEY=${jwt('service_role')}\n` });
    const r = await go(dir, ['backup.json', '--apply'], fakeSupabase());
    expect(r.code).toBe(1); expect(r.text).toMatch(/RAHASIA/);
  });
  it('menolak kalau URL C sama dengan database absensi (tidak boleh ditulis)', async () => {
    const dir = project({ env: `VITE_SUPABASE_URL=${URL_C}/rest/v1/\nVITE_SUPABASE_ANON_KEY=${ANON}\nVITE_ABSENSI_SUPABASE_URL=${URL_C}\nVITE_ABSENSI_SUPABASE_ANON_KEY=${ANON}\n` });
    const fake = fakeSupabase();
    const r = await go(dir, ['backup.json', '--apply'], fake);
    expect(r.code).toBe(1); expect(r.text).toMatch(/absensi/i); expect(fake.calls).toEqual([]);
  });
  it('hanya berbicara ke host C (tidak pernah ke host absensi)', async () => {
    const dir = project({ env: `VITE_SUPABASE_URL=${URL_C}\nVITE_SUPABASE_ANON_KEY=${ANON}\nVITE_ABSENSI_SUPABASE_URL=https://absensi99.supabase.co\nVITE_ABSENSI_SUPABASE_ANON_KEY=${ANON}\n` });
    const fake = fakeSupabase(); await go(dir, ['backup.json', '--riwayat', '--apply'], fake);
    expect(new Set(fake.calls.map((c) => c.host))).toEqual(new Set([HOST]));
  });
  it('file backup tidak ada / bukan JSON / bukan backup: pesan jelas, tidak ada tulisan', async () => {
    const fake = fakeSupabase();
    const missing = await go(project(), ['tidak-ada.json', '--apply'], fake); expect(missing.code).toBe(1); expect(missing.text).toMatch(/tidak ditemukan/);
    const bad = await go(project({ backupRaw: '{ rusak' }), ['backup.json', '--apply'], fake); expect(bad.code).toBe(1); expect(bad.text).toMatch(/bukan JSON/);
    const arrayFile = await go(project({ backupRaw: '[1,2]' }), ['backup.json', '--apply'], fake); expect(arrayFile.code).toBe(1); expect(arrayFile.text).toMatch(/bukan backup/);
    expect(fake.writes()).toEqual([]);
  });
});

describe('membatalkan (--batalkan)', () => {
  async function migrated() {
    const fake = fakeSupabase(); const dir = project();
    await go(dir, ['backup.json', '--riwayat', '--apply'], fake);
    return { fake, dir, log: fs.readdirSync(dir).find((f) => f.startsWith('migrasi-log-')) };
  }
  it('tanpa --apply hanya menampilkan rencana; dengan --apply menghapus persis yang ditulis', async () => {
    const { fake, dir, log } = await migrated();
    const before = fake.writes().length;
    const dry = await go(dir, ['--batalkan', log], fake);
    expect(dry.code).toBe(0); expect(dry.text).toMatch(/SIMULASI/); expect(fake.writes().length).toBe(before);
    expect(rows(fake, 'menu_items')).toHaveLength(5);

    const real = await go(dir, ['--batalkan', log, '--apply'], fake);
    expect(real.code).toBe(0); expect(real.text).toMatch(/Selesai/);
    for (const t of ['categories', 'menu_items', 'variant_groups', 'variant_categories', 'customers', 'vouchers', 'employees', 'transactions', 'expenses', 'shifts', 'expense_categories']) expect(rows(fake, t), t).toEqual([]);
  });
  it('tidak menghapus data C yang bukan hasil migrasi', async () => {
    const { fake, dir, log } = await migrated();
    fake.tables.menu_items.push({ id: 'punya-sendiri', category_id: 'x', name: 'Buatan Sendiri', price: 1 });
    await go(dir, ['--batalkan', log, '--apply'], fake);
    expect(rows(fake, 'menu_items').map((m) => m.id)).toEqual(['punya-sendiri']);
  });
  it('menolak log dari project lain, log rusak, atau file yang bukan log', async () => {
    const { fake, dir, log } = await migrated();
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, log), 'utf8'));
    fs.writeFileSync(path.join(dir, 'lain.json'), JSON.stringify({ ...parsed, host: 'zzzz….other.co' }));
    const other = await go(dir, ['--batalkan', 'lain.json', '--apply'], fake); expect(other.code).toBe(1); expect(other.text).toMatch(/project/);
    fs.writeFileSync(path.join(dir, 'rusak.json'), '{ x'); expect((await go(dir, ['--batalkan', 'rusak.json', '--apply'], fake)).text).toMatch(/rusak/);
    fs.writeFileSync(path.join(dir, 'bukan.json'), '{"a":1}'); expect((await go(dir, ['--batalkan', 'bukan.json', '--apply'], fake)).text).toMatch(/bukan berkas log/);
    expect(rows(fake, 'menu_items')).toHaveLength(5);
  });
  it('kalau satu tabel gagal dihapus (masih dipakai), tabel lain tetap diproses dan hasilnya dilaporkan', async () => {
    const { fake, dir, log } = await migrated();
    const orig = fake.fetchImpl;
    const wrapped = async (url, init = {}) => (init.method === 'DELETE' && /\/employees\?/.test(url))
      ? new Response(JSON.stringify({ message: 'violates foreign key constraint' }), { status: 409 })
      : orig(url, init);
    const r = await go(dir, ['--batalkan', log, '--apply'], { fetchImpl: wrapped });
    expect(r.code).toBe(1); expect(r.text).toMatch(/Karyawan\s+gagal/);
    expect(rows(fake, 'employees')).toHaveLength(2); expect(rows(fake, 'menu_items')).toEqual([]);
  });
});

describe('klien Supabase', () => {
  it('insertIgnore: baris yang sudah ada dilewati (bukan error, bukan ditimpa) — header & on_conflict benar', async () => {
    const fake = fakeSupabase({ seed: { categories: [{ id: 'a', name: 'Lama' }] } });
    const client = createClient({ url: `${URL_C}/rest/v1/`, key: ANON, fetchImpl: fake.fetchImpl });
    await client.insertIgnore('categories', [{ id: 'a', name: 'Baru' }, { id: 'b', name: 'B' }], 'id');
    expect(fake.tables.categories).toEqual([{ id: 'a', name: 'Lama' }, { id: 'b', name: 'B' }]);
    await client.insertIgnore('menu_item_variant_groups', [{ menu_item_id: 'm', variant_group_id: 'g' }], 'menu_item_id,variant_group_id');
    await client.insertIgnore('menu_item_variant_groups', [{ menu_item_id: 'm', variant_group_id: 'g' }], 'menu_item_id,variant_group_id');
    expect(fake.tables.menu_item_variant_groups).toHaveLength(1);
  });
  it('insertIgnore memecah batch 500 baris dan melapor tiap batch yang berhasil', async () => {
    const fake = fakeSupabase();
    const client = createClient({ url: URL_C, key: ANON, fetchImpl: fake.fetchImpl });
    const rowsIn = Array.from({ length: 1201 }, (_, i) => ({ id: `r${i}` }));
    const batches = [];
    await client.insertIgnore('categories', rowsIn, 'id', (chunk) => batches.push(chunk.length));
    expect(batches).toEqual([500, 500, 201]); expect(fake.tables.categories).toHaveLength(1201);
  });
  it('kesalahan jaringan dan 401/409 menjadi ApiError berbahasa jelas', async () => {
    const down = createClient({ url: URL_C, key: ANON, fetchImpl: async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }); } });
    await expect(down.selectAll('categories', 'id', 'id')).rejects.toThrow(/Tidak bisa menghubungi Supabase \(ENOTFOUND\)/);
    const wrongKey = createClient({ url: URL_C, key: 'salah', fetchImpl: fakeSupabase().fetchImpl });
    await expect(wrongKey.selectAll('categories', 'id', 'id')).rejects.toThrow(ApiError);
    const noTable = createClient({ url: URL_C, key: ANON, fetchImpl: async () => new Response(JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.x' in the schema cache" }), { status: 404 }) });
    await expect(noTable.selectAll('x', 'id', 'id')).rejects.toThrow(/jalankan SQL schema/);
  });
  it('deleteIn memecah URL panjang jadi beberapa permintaan kecil', async () => {
    const fake = fakeSupabase({ seed: { categories: Array.from({ length: 150 }, (_, i) => ({ id: `r${i}` })) } });
    const client = createClient({ url: URL_C, key: ANON, fetchImpl: fake.fetchImpl });
    await client.deleteIn('categories', 'id', Array.from({ length: 150 }, (_, i) => `r${i}`));
    expect(fake.tables.categories).toEqual([]);
    expect(fake.calls.filter((c) => c.method === 'DELETE').length).toBe(3);
  });
});
