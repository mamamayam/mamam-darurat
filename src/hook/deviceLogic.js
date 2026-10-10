/**
 * deviceLogic — aturan murni fitur Perangkat terdaftar (dites di deviceLogic.test.js).
 *
 * Status HP ini (hasil cek ke server): memuat | terdaftar | menunggu | dicabut | tidak-tersedia | gagal
 *  - tidak-tersedia = migrasi 011 belum dijalankan: fitur dilewati, tidak ada yang dikunci.
 *  - gagal          = server tidak terjangkau dan belum pernah terdaftar di HP ini.
 */
export const STATUS = { LOADING: 'memuat', OK: 'terdaftar', PENDING: 'menunggu', REVOKED: 'dicabut', OFF: 'tidak-tersedia', FAILED: 'gagal' };

/** Kapan layar kunci tampil. Hanya STAF yang dikunci; owner selalu bisa masuk untuk mendaftarkan HP. */
export function deviceLock(role, status) {
  if (role !== 'staff') return null;
  if (status === STATUS.OK || status === STATUS.OFF) return null;
  return status; // memuat | menunggu | dicabut | gagal
}

/** Error "tabel belum ada" dari PostgREST / Postgres. */
export const isMissingTable = (e) => Boolean(e) && (
  e.code === 'PGRST205' || e.code === '42P01' || /does not exist|schema cache|could not find the table/i.test(e.message || '')
);

export const normName = (s) => String(s || '').trim().replace(/\s+/g, ' ');

/** Validasi nama perangkat: wajib, maksimal 40 huruf, tidak boleh sama dengan HP lain yang terdaftar. */
export function validateDeviceName(name, devices = [], selfId = null) {
  const n = normName(name);
  if (!n) return { ok: false, message: 'Isi nama perangkat.' };
  if (n.length > 40) return { ok: false, message: 'Nama perangkat maksimal 40 huruf.' };
  const dup = devices.some((d) => d.id !== selfId && d.status === 'terdaftar' && normName(d.name).toLowerCase() === n.toLowerCase());
  if (dup) return { ok: false, message: 'Nama itu sudah dipakai HP lain.' };
  return { ok: true, name: n };
}

const ORDER = { menunggu: 0, terdaftar: 1, dicabut: 2 };
/** Menunggu dulu, lalu terdaftar (yang terakhir aktif di atas), lalu dicabut. */
export function sortDevices(list) {
  const t = (d) => new Date(d.last_seen_at || d.created_at || 0).getTime();
  return [...list].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || t(b) - t(a));
}

export function lastSeenLabel(ts, now = Date.now()) {
  if (!ts) return 'Belum pernah aktif';
  const min = Math.floor((now - new Date(ts).getTime()) / 60000);
  if (min < 1) return 'Aktif baru saja';
  if (min < 60) return `Aktif ${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Aktif ${h} jam lalu`;
  return `Aktif ${Math.floor(h / 24)} hari lalu`;
}

/** Terakhir-aktif cukup disegarkan tiap 5 menit supaya tidak menulis ke database terus. */
export const needsSeenUpdate = (ts, now = Date.now()) => !ts || now - new Date(ts).getTime() > 5 * 60000;

export const DEVICE_FILTER_NONE = 'tanpa';
/** Pilihan filter Riwayat dari data yang sedang tampil: id perangkat -> nama terbaru. [{ key, label }] */
export function deviceOptionsFromRows(rows) {
  const names = new Map();
  let hasNone = false;
  for (const r of rows) {
    if (!r.device_id) { hasNone = true; continue; }
    if (!names.has(r.device_id) || (!names.get(r.device_id) && r.device_name)) names.set(r.device_id, r.device_name || '');
  }
  const opts = [...names].map(([key, name]) => ({ key, label: name || 'Perangkat tanpa nama' }))
    .sort((a, b) => a.label.localeCompare(b.label, 'id'));
  if (hasNone) opts.push({ key: DEVICE_FILTER_NONE, label: 'Tanpa perangkat' });
  return opts;
}
