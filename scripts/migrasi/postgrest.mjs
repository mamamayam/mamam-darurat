/**
 * postgrest.mjs — klien tipis ke API REST Supabase (PostgREST) pakai fetch bawaan Node.
 * Tanpa paket tambahan. Hanya dipakai skrip migrasi; TIDAK dipakai aplikasi.
 *
 * Kunci (anon key) hanya dikirim sebagai header ke URL project C milik pengguna
 * sendiri; tidak pernah dicetak.
 */

const PAGE = 1000;           // batas baris per permintaan di Supabase
const INSERT_BATCH = 500;
const DELETE_BATCH = 60;     // id uuid panjang; jaga URL tetap pendek

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createClient({ url, key, fetchImpl = globalThis.fetch }) {
  const base = `${String(url).trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')}/rest/v1`;
  const auth = { apikey: key, Authorization: `Bearer ${key}` };

  async function request(method, path, { body, prefer } = {}) {
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          ...auth,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(prefer ? { Prefer: prefer } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ApiError(`Tidak bisa menghubungi Supabase (${err?.cause?.code || err?.message || 'jaringan'}). Cek koneksi internet dan VITE_SUPABASE_URL di .env.local.`);
    }
    if (!res.ok) {
      let payload = null;
      try { payload = await res.json(); } catch { /* bukan JSON */ }
      const msg = payload?.message || `HTTP ${res.status}`;
      let hint = '';
      if (res.status === 401 || res.status === 403) hint = ' (cek VITE_SUPABASE_ANON_KEY di .env.local)';
      if (payload?.code === 'PGRST205' || /schema cache/i.test(msg)) hint = ' (tabel belum ada: jalankan SQL schema/migrasi C di Supabase dulu)';
      throw new ApiError(`Supabase menolak: ${msg}${hint}`, { status: res.status, code: payload?.code, details: payload?.details });
    }
    return res;
  }

  /** Ambil SEMUA baris (berhalaman). */
  async function selectAll(table, columns, orderBy) {
    const all = [];
    for (let offset = 0; ; offset += PAGE) {
      const res = await request('GET', `/${table}?select=${columns}&order=${orderBy}&limit=${PAGE}&offset=${offset}`);
      const rows = await res.json();
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    return all;
  }

  /**
   * Tambah baris; yang bentrok kunci utamanya DILEWATI (tidak ditimpa).
   * `onBatch(chunk)` dipanggil setelah SETIAP batch berhasil, supaya pemanggil bisa
   * mencatat persis apa yang sudah tertulis kalau batch berikutnya gagal.
   */
  async function insertIgnore(table, rows, conflict, onBatch) {
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const chunk = rows.slice(i, i + INSERT_BATCH);
      await request('POST', `/${table}?on_conflict=${conflict}`, { body: chunk, prefer: 'resolution=ignore-duplicates,return=minimal' });
      if (onBatch) onBatch(chunk);
    }
  }

  async function deleteIn(table, column, ids) {
    for (let i = 0; i < ids.length; i += DELETE_BATCH) {
      const chunk = ids.slice(i, i + DELETE_BATCH);
      await request('DELETE', `/${table}?${column}=in.(${chunk.join(',')})`, { prefer: 'return=minimal' });
    }
  }

  return { selectAll, insertIgnore, deleteIn };
}

/** Kolom yang dibaca dari C untuk mencocokkan data yang sudah ada. [kolom, urutan] */
export const EXISTING_READ = {
  categories: ['id,name', 'id'],
  menu_items: ['id,category_id,name', 'id'],
  variant_categories: ['id,name', 'id'],
  variant_groups: ['id,name,category_id', 'id'],
  variant_options: ['id,variant_group_id,name', 'id'],
  menu_item_variant_groups: ['menu_item_id,variant_group_id', 'menu_item_id,variant_group_id'],
  customers: ['id,name,phone', 'id'],
  vouchers: ['id,code', 'id'],
  employees: ['id,external_id,name', 'id'],
};
export const EXISTING_READ_HISTORY = {
  expense_categories: ['id,name,sort_order', 'id'],
  transactions: ['id', 'id'],
  expenses: ['id', 'id'],
  shifts: ['id,opened_at,closed_at', 'id'],
};

/** Kunci konflik per tabel untuk insertIgnore. */
export const CONFLICT_KEY = {
  menu_item_variant_groups: 'menu_item_id,variant_group_id',
};
export const conflictOf = (table) => CONFLICT_KEY[table] ?? 'id';
