/**
 * menuOrder — urutan ikon menu slide-up yang bisa diatur sendiri (drag & drop).
 * FUNGSI MURNI (dites) + simpan/baca per peran di localStorage perangkat ini.
 *
 * Urutan disimpan sebagai daftar id. Menu baru yang belum ada di daftar tersimpan
 * ditaruh di belakang (urutan bawaan), dan id yang sudah tidak ada diabaikan, jadi
 * menambah/menghapus menu di kode tidak merusak urutan pilihan pengguna.
 */
export const MENU_ORDER_KEY = 'mamam-pos-menu-order';

/** Susun `items` ({ id, ... }) menurut `savedIds`; sisanya mengikuti urutan bawaan di belakang. */
export function orderMenus(items, savedIds) {
  const saved = Array.isArray(savedIds) ? savedIds : [];
  const byId = new Map(items.map((it) => [it.id, it]));
  const picked = [];
  for (const id of saved) {
    if (byId.has(id)) { picked.push(byId.get(id)); byId.delete(id); }   // `delete` juga membuang id ganda
  }
  return [...picked, ...byId.values()];
}

/** Pindahkan `fromId` ke posisi `toId` (yang lain bergeser). Id tak dikenal = tidak berubah. */
export function moveId(ids, fromId, toId) {
  const from = ids.indexOf(fromId), to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

/** Id elemen yang persegi panjangnya memuat titik (x, y); null kalau di luar semuanya. */
export function itemAtPoint(rects, x, y) {
  for (const [id, r] of Object.entries(rects)) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
  }
  return null;
}

const keyFor = (role) => `${MENU_ORDER_KEY}:${role || 'umum'}`;

export function readMenuOrder(role, storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(keyFor(role)) || 'null');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : null;
  } catch { return null; }
}

export function saveMenuOrder(role, ids, storage = globalThis.localStorage) {
  try { storage?.setItem(keyFor(role), JSON.stringify(ids)); } catch { /* storage penuh / diblokir: abaikan */ }
}

export function clearMenuOrder(role, storage = globalThis.localStorage) {
  try { storage?.removeItem(keyFor(role)); } catch { /* abaikan */ }
}
