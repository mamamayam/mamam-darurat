/**
 * Service worker Mamam Darurat (PWA).
 *
 * Tugasnya SEMPIT: membuat aplikasi bisa dipasang ke HP dan terbuka cepat. C tetap
 * online-first, jadi yang disimpan hanya "cangkang" aplikasi (halaman utama + berkas
 * /assets/ yang namanya berhash). DATA TIDAK PERNAH DISENTUH:
 *   - permintaan ke domain lain (Supabase, database absensi, font Google) -> tidak
 *     diintersep sama sekali (tidak ada respondWith), langsung ke jaringan;
 *   - permintaan selain GET -> tidak diintersep;
 *   - berkas same-origin di luar /assets/ (manifest, ikon, sw.js) -> tidak diintersep.
 * (Pelajaran dari mamam-global: cache untuk *.supabase.co bikin data POS basi dan lambat.)
 *
 * Strategi:
 *   - Navigasi (membuka/refresh aplikasi): jaringan dulu, cangkang tersimpan hanya kalau
 *     jaringan gagal. Jadi setiap deploy baru langsung terpakai saat online.
 *   - /assets/*: cache dulu (nama berhash = isi tidak pernah berubah), diisi saat pertama dimuat.
 *     Respons HTML tidak pernah disimpan sebagai aset (cegah SPA-fallback meracuni cache).
 *
 * Kalau logika di sini berubah, naikkan nomor versi cache supaya cache lama dibuang.
 */
const SHELL_CACHE = 'mdr-shell-v1';
const ASSET_CACHE = 'mdr-assets-v1';
const MAX_ASSETS = 60;   // batas jumlah berkas di cache aset; yang tertua dibuang

const SCOPE = self.registration.scope;                       // mis. https://situs.vercel.app/
const ASSET_PREFIX = new URL('assets/', SCOPE).pathname;     // mis. /assets/

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Simpan cangkang saat pemasangan supaya aplikasi bisa dibuka sekali pun sedang offline.
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(SCOPE, { cache: 'reload' })))
      .catch(() => { /* gagal (offline/error): tidak apa-apa, terisi pada kunjungan berikutnya */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== SHELL_CACHE && n !== ASSET_CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase dll: lewat apa adanya

  if (req.mode === 'navigate') {
    event.respondWith(shellNetworkFirst(req));
  } else if (url.pathname.startsWith(ASSET_PREFIX)) {
    event.respondWith(assetCacheFirst(req));
  }
});

async function shellNetworkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then((c) => c.put(SCOPE, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await caches.match(SCOPE, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    throw err;
  }
}

async function assetCacheFirst(req) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  const type = (res && res.headers && res.headers.get('content-type')) || '';
  if (res && res.ok && res.status === 200 && res.type === 'basic' && !type.includes('text/html')) {
    cache.put(req, res.clone()).then(() => trimAssets(cache)).catch(() => {});
  }
  return res;
}

async function trimAssets(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i += 1) await cache.delete(keys[i]);
}
