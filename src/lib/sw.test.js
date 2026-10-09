import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

/**
 * Menguji public/sw.js (service worker) dengan menjalankannya di sandbox `vm`
 * bersama `self`, `caches`, dan `fetch` palsu. Yang dijaga terutama aturan "jangan pernah
 * menyentuh data": permintaan ke Supabase/domain lain dan non-GET tidak boleh diintersep.
 */
const SRC = fs.readFileSync(fileURLToPath(new URL('../../public/sw.js', import.meta.url)), 'utf8');
const ORIGIN = 'https://app.test';
const SCOPE = `${ORIGIN}/`;

const tick = () => new Promise((r) => setTimeout(r, 0));

function res({ status = 200, type = 'basic', contentType = 'application/javascript', body = 'x' } = {}) {
  const r = {
    ok: status >= 200 && status < 300, status, type, body,
    headers: new Headers({ 'content-type': contentType }),
    clone: () => ({ ...r, clone: r.clone }),
  };
  return r;
}

function loadSW({ fetchImpl = async () => res() } = {}) {
  const handlers = {};
  const store = new Map();                                   // namaCache -> Map(url -> respons)
  const urlOf = (k) => (typeof k === 'string' ? k : k.url);
  const makeCache = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    return {
      async add(req) { m.set(urlOf(req), await fetchImpl(req)); },
      async put(key, r) { m.set(urlOf(key), r); },
      async match(key) { return m.get(urlOf(key)); },
      async keys() { return [...m.keys()].map((url) => ({ url })); },
      async delete(key) { return m.delete(urlOf(key)); },
    };
  };
  const caches = {
    open: async (name) => makeCache(name),
    async match(key, { cacheName } = {}) { return store.get(cacheName)?.get(urlOf(key)); },
    keys: async () => [...store.keys()],
    delete: async (name) => store.delete(name),
  };
  const calls = { fetch: [], skipWaiting: 0, claim: 0 };
  const self = {
    registration: { scope: SCOPE },
    location: { origin: ORIGIN },
    skipWaiting: () => { calls.skipWaiting += 1; },
    clients: { claim: async () => { calls.claim += 1; } },
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };
  const fetchSpy = (req) => { calls.fetch.push(typeof req === 'string' ? req : req.url); return fetchImpl(req); };
  vm.runInNewContext(SRC, { self, caches, fetch: fetchSpy, URL, Request, Promise, console });

  /** Kirim peristiwa fetch; hasilnya: promise respons, atau null kalau TIDAK diintersep. */
  const request = (url, { method = 'GET', mode = 'cors' } = {}) => {
    const event = { request: { url, method, mode }, responded: null, respondWith(p) { event.responded = p; } };
    handlers.fetch(event);
    return event.responded;
  };
  const lifecycle = async (type) => {
    let waiting; handlers[type]({ waitUntil(p) { waiting = p; } });
    await waiting;
  };
  return { store, calls, request, lifecycle };
}

describe('service worker — pemasangan', () => {
  it('install: langsung aktif (skipWaiting) dan menyimpan cangkang aplikasi', async () => {
    const sw = loadSW({ fetchImpl: async () => res({ contentType: 'text/html', body: 'SHELL' }) });
    await sw.lifecycle('install');
    expect(sw.calls.skipWaiting).toBe(1);
    expect((await sw.store.get('mamam-pos-shell-v1').get(SCOPE)).body).toBe('SHELL');
  });

  it('install tetap berhasil walau jaringan gagal (tidak menggagalkan pemasangan)', async () => {
    const sw = loadSW({ fetchImpl: async () => { throw new TypeError('offline'); } });
    await expect(sw.lifecycle('install')).resolves.toBeUndefined();
    expect(sw.calls.skipWaiting).toBe(1);
  });

  it('activate: membuang cache lama/asing, menyimpan dua cache sekarang, lalu mengambil alih halaman', async () => {
    const sw = loadSW();
    for (const n of ['mamam-pos-shell-v1', 'mamam-pos-assets-v1', 'mamam-pos-shell-v0', 'cache-asing']) sw.store.set(n, new Map([['u', res()]]));
    await sw.lifecycle('activate');
    expect([...sw.store.keys()].sort()).toEqual(['mamam-pos-assets-v1', 'mamam-pos-shell-v1']);
    expect(sw.calls.claim).toBe(1);
  });
});

describe('service worker — yang TIDAK boleh diintersep (data)', () => {
  it.each([
    ['REST Supabase', 'https://abc.supabase.co/rest/v1/orders?select=*'],
    ['Realtime Supabase (HTTP)', 'https://abc.supabase.co/realtime/v1/api/broadcast'],
    ['database absensi', 'https://xyz.supabase.co/rest/v1/attendanceLog'],
    ['font Google', 'https://fonts.googleapis.com/css2?family=Montserrat'],
    ['aset di domain lain yang pathnya /assets/', 'https://cdn.example.com/assets/app.js'],
  ])('%s: tidak diintersep dan tidak menyentuh jaringan lewat SW', (_n, url) => {
    const sw = loadSW();
    expect(sw.request(url)).toBeNull();
    expect(sw.calls.fetch).toEqual([]);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s ke domain sendiri: tidak diintersep', (method) => {
    const sw = loadSW();
    expect(sw.request(`${ORIGIN}/assets/app.js`, { method })).toBeNull();
    expect(sw.request(`${ORIGIN}/`, { method, mode: 'navigate' })).toBeNull();
  });

  it.each(['/manifest.webmanifest', '/icons/icon-192.png', '/sw.js', '/favicon.png', '/api/apa-saja'])(
    'berkas domain sendiri di luar /assets/ (%s): tidak diintersep', (path) => {
      expect(loadSW().request(`${ORIGIN}${path}`)).toBeNull();
    });
});

describe('service worker — membuka aplikasi (navigasi): jaringan dulu', () => {
  const nav = { mode: 'navigate' };

  it('online: pakai respons jaringan dan simpan salinannya sebagai cangkang', async () => {
    const sw = loadSW({ fetchImpl: async () => res({ contentType: 'text/html', body: 'BARU' }) });
    const out = await sw.request(`${ORIGIN}/`, nav);
    expect(out.body).toBe('BARU');
    await tick();
    expect(sw.store.get('mamam-pos-shell-v1').get(SCOPE).body).toBe('BARU');
  });

  it('offline: memakai cangkang tersimpan', async () => {
    let online = true;
    const sw = loadSW({ fetchImpl: async () => { if (!online) throw new TypeError('offline'); return res({ contentType: 'text/html', body: 'LAMA' }); } });
    await sw.request(`${ORIGIN}/`, nav); await tick();
    online = false;
    const out = await sw.request(`${ORIGIN}/?utm=1`, nav);
    expect(out.body).toBe('LAMA');
  });

  it('offline dan belum ada cangkang: galat diteruskan (browser menampilkan halaman offline-nya sendiri)', async () => {
    const sw = loadSW({ fetchImpl: async () => { throw new TypeError('offline'); } });
    await expect(sw.request(`${ORIGIN}/`, nav)).rejects.toThrow('offline');
  });

  it('server menjawab galat (500): jawaban itu diteruskan apa adanya dan TIDAK menimpa cangkang tersimpan', async () => {
    let status = 200;
    const sw = loadSW({ fetchImpl: async () => res({ status, contentType: 'text/html', body: status === 200 ? 'BAGUS' : 'RUSAK' }) });
    await sw.request(`${ORIGIN}/`, nav); await tick();
    status = 500;
    const out = await sw.request(`${ORIGIN}/`, nav); await tick();
    expect(out.body).toBe('RUSAK');
    expect(sw.store.get('mamam-pos-shell-v1').get(SCOPE).body).toBe('BAGUS');
  });
});

describe('service worker — berkas /assets/ (cache dulu)', () => {
  const A = `${ORIGIN}/assets/index-abc123.js`;

  it('pertama kali dari jaringan lalu disimpan; berikutnya dari cache tanpa jaringan', async () => {
    const sw = loadSW({ fetchImpl: async () => res({ body: 'JS' }) });
    expect((await sw.request(A)).body).toBe('JS');
    await tick();
    expect(sw.calls.fetch).toEqual([A]);
    expect((await sw.request(A)).body).toBe('JS');
    expect(sw.calls.fetch).toEqual([A]);                      // tidak fetch lagi
  });

  it('respons HTML untuk berkas aset (SPA-fallback) TIDAK disimpan', async () => {
    const sw = loadSW({ fetchImpl: async () => res({ contentType: 'text/html; charset=utf-8', body: '<html>' }) });
    await sw.request(A); await tick();
    expect(sw.store.get('mamam-pos-assets-v1')?.size ?? 0).toBe(0);
  });

  it.each([
    ['404', { status: 404 }],
    ['500', { status: 500 }],
    ['206 sebagian', { status: 206 }],
    ['opaque', { type: 'opaque' }],
    ['cors', { type: 'cors' }],
  ])('respons %s tidak disimpan', async (_n, opts) => {
    const sw = loadSW({ fetchImpl: async () => res(opts) });
    await sw.request(A); await tick();
    expect(sw.store.get('mamam-pos-assets-v1')?.size ?? 0).toBe(0);
  });

  it('jaringan gagal dan belum ada di cache: galat diteruskan', async () => {
    const sw = loadSW({ fetchImpl: async () => { throw new TypeError('offline'); } });
    await expect(sw.request(A)).rejects.toThrow('offline');
  });

  it('cache dibatasi 60 berkas: yang tertua dibuang', async () => {
    const sw = loadSW({ fetchImpl: async () => res() });
    for (let i = 0; i < 65; i += 1) { await sw.request(`${ORIGIN}/assets/f${i}.js`); await tick(); }
    const keys = [...sw.store.get('mamam-pos-assets-v1').keys()];
    expect(keys.length).toBe(60);
    expect(keys).not.toContain(`${ORIGIN}/assets/f0.js`);
    expect(keys).toContain(`${ORIGIN}/assets/f64.js`);
  });
});
