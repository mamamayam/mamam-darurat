/**
 * ambil-a.mjs — ambil data LENGKAP dari database Supabase app lama (A / mamam-global) dan gabungkan
 * dengan file backup yang sudah ada, tanpa duplikat. Hasilnya berupa file JSON yang bisa langsung
 * dipakai scripts/migrasi-dari-a.mjs.
 *
 * Kenapa ada: Export JSON dari satu HP bisa ketinggalan (HP lain belum sinkron / ekspor lama),
 * sedangkan tabel Supabase A berisi gabungan semua perangkat.
 *
 * Aturan keselamatan:
 *  - HANYA membaca (GET). Tidak ada tulis ke A maupun C.
 *  - Menolak kunci rahasia (service_role / sb_secret_), dan menolak kalau alamat A sama dengan C.
 *  - Kunci tidak pernah dicetak. File hasil tidak menimpa file yang sudah ada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from './cli.mjs';

export const TABEL_A = ['salesHistory', 'customers', 'expenses', 'incomes', 'shiftHistory'];
const BAWAAN = ['salesHistory'];
const PAGE = 1000;

export const HELP = `
Ambil data lengkap dari Supabase app lama (A) lalu gabungkan dengan backup yang sudah ada.

Isi .env.local (di folder mamam-pos) dengan alamat & kunci "anon" project A (ada di .env app lama):
  A_SUPABASE_URL=https://xxxxxxxx.supabase.co
  A_SUPABASE_ANON_KEY=eyJ...

Pakai:
  node scripts/ambil-dari-supabase-a.mjs --gabung "C:\\\\path\\\\backup.json"
  node scripts/migrasi-dari-a.mjs hasil-gabungan-XXXX.json --riwayat          (simulasi dulu)
  node scripts/migrasi-dari-a.mjs hasil-gabungan-XXXX.json --riwayat --apply

Pilihan:
  --gabung <file>   backup JSON yang mau digabung (mis. ekspor dari app / pelengkap-dari-excel.json)
  --tabel <daftar>  tabel yang diambil, dipisah koma. Bawaan: ${BAWAAN.join(',')}
                    Pilihan: ${TABEL_A.join(', ')}
                    (catatan: tabel customers di A hanya boleh dibaca user yang login, jadi kunci anon
                    mendapat daftar kosong; pelanggan diambil dari file gabung)
  --lewati <id,id>  id data yang TIDAK boleh ikut (mis. data uji coba), dibuang dari Supabase maupun file gabung
  --keluar <file>   nama file hasil (bawaan: hasil-gabungan-<tanggal>.json; tidak menimpa file lama)
  --env <file>      pakai file env selain .env.local
  --help            tampilkan bantuan ini

Aturan gabung: id yang sama dianggap SATU data (tidak digandakan). Isi dari Supabase dipakai; kolom
yang kosong di sana dilengkapi dari file gabungan. Yang dihapus di salah satu sisi tetap dianggap dihapus.
`;

const cleanUrl = (u) => String(u || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function keyKind(key) {
  const k = String(key || '').trim();
  if (k.startsWith('sb_secret_')) return 'secret';
  if (k.startsWith('sb_publishable_')) return 'publishable';
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const role = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role;
      if (role === 'anon') return 'anon';
      if (role === 'service_role') return 'secret';
    } catch { /* bukan JWT */ }
  }
  return 'unknown';
}

export function parseArgs(argv) {
  const o = { gabung: null, keluar: null, tabel: [...BAWAAN], lewati: [], envFile: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (!v || v.startsWith('--')) throw new Error(`${a} perlu nilai.`); return v; };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--gabung') o.gabung = val();
    else if (a === '--keluar') o.keluar = val();
    else if (a === '--env') o.envFile = val();
    else if (a === '--lewati') o.lewati = val().split(',').map((x) => x.trim()).filter(Boolean);
    else if (a === '--tabel') {
      o.tabel = val().split(',').map((s) => s.trim()).filter(Boolean);
      const salah = o.tabel.filter((t) => !TABEL_A.includes(t));
      if (salah.length) throw new Error(`Tabel tidak dikenal: ${salah.join(', ')}. Pilihan: ${TABEL_A.join(', ')}.`);
      if (o.tabel.length === 0) throw new Error('--tabel kosong.');
    } else throw new Error(`Pilihan tidak dikenal: ${a}. Lihat --help.`);
  }
  return o;
}

/** Baris tabel A ({ id, payload, deleted_at }) -> data seperti isi backup JSON. */
export function rowToRecord(row) {
  const payload = isObj(row?.payload) ? row.payload : {};
  const deletedAt = payload.deletedAt ?? row?.deleted_at ?? null;
  return { ...payload, id: row?.id ?? payload.id ?? null, deletedAt };
}

const kosong = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Gabungkan daftar dari Supabase (dipakai sebagai utama) dengan daftar dari file backup, per id.
 * Mengembalikan { rows, stats }.
 */
export function mergeRecords(fetched, base, { cekNilai = ['total', 'amount'] } = {}) {
  const baseList = Array.isArray(base) ? base.filter(isObj) : [];
  const byId = new Map();
  const order = [];
  const stats = { dariSupabase: 0, hanyaDiFile: 0, keduanya: 0, dilengkapi: 0, bedaNilai: [], tanpaId: 0 };

  for (const r of fetched) {
    if (!isObj(r) || r.id === null || r.id === undefined || r.id === '') { stats.tanpaId += 1; continue; }
    if (byId.has(r.id)) continue;
    byId.set(r.id, { ...r });
    order.push(r.id);
    stats.dariSupabase += 1;
  }
  const hanyaFile = [];
  for (const b of baseList) {
    const id = b.id;
    if (id === null || id === undefined || id === '') { hanyaFile.push(b); stats.tanpaId += 1; continue; }
    const cur = byId.get(id);
    if (!cur) { byId.set(id, { ...b }); order.push(id); stats.hanyaDiFile += 1; continue; }
    stats.keduanya += 1;
    let diisi = false;
    for (const [k, v] of Object.entries(b)) {
      if (k === 'deletedAt') { if (kosong(cur.deletedAt) && !kosong(v)) { cur.deletedAt = v; diisi = true; } continue; }
      if (kosong(cur[k]) && !kosong(v)) { cur[k] = v; diisi = true; }
    }
    if (diisi) stats.dilengkapi += 1;
    for (const f of cekNilai) {
      if (f in b && f in cur && Number(b[f]) !== Number(cur[f])) { stats.bedaNilai.push(`${id} (${f}: file ${b[f]} / Supabase ${cur[f]})`); break; }
    }
  }
  return { rows: [...order.map((id) => byId.get(id)), ...hanyaFile], stats };
}

/** Ambil semua baris satu tabel (hanya GET, per 1000 baris). */
export async function fetchTable({ url, key, table, fetchImpl = fetch }) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const endpoint = `${url}/rest/v1/${encodeURIComponent(table)}?select=id,payload,deleted_at&order=id.asc&limit=${PAGE}&offset=${offset}`;
    let res;
    try { res = await fetchImpl(endpoint, { method: 'GET', headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }); }
    catch (err) { throw new Error(`Tidak bisa menghubungi A untuk tabel ${table}: ${err.message}`); }
    if (!res.ok) {
      const hint = res.status === 401 || res.status === 403 ? ' (kunci salah, atau tabel ini tidak boleh dibaca kunci anon)' : res.status === 404 ? ' (tabel tidak ditemukan)' : '';
      throw new Error(`Tabel ${table} gagal dibaca: HTTP ${res.status}${hint}`);
    }
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`Tabel ${table}: jawaban A bukan daftar.`);
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

function loadSource(envFile, explicit, env) {
  const fromFile = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : (explicit ? (() => { throw new Error(`File env tidak ditemukan: ${envFile}`); })() : {});
  const get = (k) => String(fromFile[k] ?? env[k] ?? '').trim();
  const url = cleanUrl(get('A_SUPABASE_URL'));
  const key = get('A_SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error(`Isi A_SUPABASE_URL dan A_SUPABASE_ANON_KEY (project A) di ${envFile} atau di environment. Lihat --help.`);
  if (!/^https?:\/\//i.test(url)) throw new Error('A_SUPABASE_URL harus berupa alamat https://… (tanpa /rest/v1/).');
  if (keyKind(key) === 'secret') throw new Error('Kunci A adalah kunci RAHASIA (service_role/secret). Pakai kunci "anon"/"publishable" saja.');
  const c = cleanUrl(get('VITE_SUPABASE_URL'));
  if (c && hostOf(c) === hostOf(url)) throw new Error('A_SUPABASE_URL sama dengan VITE_SUPABASE_URL (project C). Yang diisi harus project A (app lama).');
  return { url, key };
}

const LABEL = { salesHistory: 'transaksi', customers: 'pelanggan', expenses: 'pengeluaran', incomes: 'pemasukan lain', shiftHistory: 'shift' };

export async function run(argv, { fetchImpl = fetch, env = process.env, cwd = process.cwd(), out = (s) => console.log(s) } = {}) {
  let args;
  try { args = parseArgs(argv); } catch (e) { out(`Gagal: ${e.message}`); return 1; }
  if (args.help) { out(HELP); return 0; }
  try {
    const envFile = path.resolve(cwd, args.envFile ?? '.env.local');
    const { url, key } = loadSource(envFile, Boolean(args.envFile), env);

    let base = {};
    if (args.gabung) {
      const f = path.resolve(cwd, args.gabung);
      if (!fs.existsSync(f) || !fs.statSync(f).isFile()) throw new Error(`File gabung tidak ditemukan: ${f}`);
      try { base = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); }
      catch (e) { throw new Error(`File gabung bukan JSON yang valid (${e.message}).`); }
      if (!isObj(base)) throw new Error('File gabung harus berupa objek JSON backup (bukan daftar).');
    }
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const outFile = path.resolve(cwd, args.keluar ?? `hasil-gabungan-${stamp}.json`);
    if (fs.existsSync(outFile)) throw new Error(`File hasil sudah ada: ${outFile}. Pilih nama lain dengan --keluar (file lama tidak ditimpa).`);

    const result = { ...base };
    const lines = ['Ambil dari Supabase A (hanya membaca)…'];
    for (const table of args.tabel) {
      const buang = new Set(args.lewati);
      const dibuang = (r) => buang.has(String(r?.id));
      const rows = (await fetchTable({ url, key, table, fetchImpl })).map(rowToRecord).filter((r) => !dibuang(r));
      const baseRows = Array.isArray(base[table]) ? base[table].filter((r) => !dibuang(r)) : base[table];
      const { rows: merged, stats } = mergeRecords(rows, baseRows);
      result[table] = merged;
      lines.push(`• ${LABEL[table]}: ${stats.dariSupabase} dari Supabase, ${stats.hanyaDiFile} hanya di file gabung, ${stats.keduanya} ada di keduanya (${stats.dilengkapi} dilengkapi dari file) → ${merged.length} data tanpa duplikat id`);
      if (buang.size) lines.push(`  ${[...buang].length} id diminta dilewati (--lewati).`);
      if (stats.dariSupabase === 0) lines.push(`  PERHATIAN: Supabase mengembalikan 0 baris untuk ${LABEL[table]}. Kalau tabelnya seharusnya berisi, kemungkinan kunci anon diblokir pengaman database (RLS) dan hanya bisa membaca daftar kosong. Isi tabel ini dari file gabung saja.`);
      if (stats.tanpaId) lines.push(`  ${stats.tanpaId} baris tanpa id dibiarkan apa adanya (tidak bisa dicek duplikatnya).`);
      if (stats.bedaNilai.length) lines.push(`  ${stats.bedaNilai.length} id yang nilainya beda antara file dan Supabase (dipakai nilai Supabase): ${stats.bedaNilai.slice(0, 5).join('; ')}${stats.bedaNilai.length > 5 ? '; …' : ''}`);
      if (table === 'salesHistory') {
        const tanpaItem = merged.filter((r) => !r.deletedAt && (!Array.isArray(r.items) || r.items.length === 0)).length;
        if (tanpaItem) lines.push(`  PERHATIAN: ${tanpaItem} transaksi tidak punya rincian item (omzet tetap ikut, tapi tidak muncul di laporan per menu).`);
      }
    }
    fs.writeFileSync(outFile, JSON.stringify(result), { flag: 'wx' });
    lines.push(`Selesai. File: ${outFile}`, 'Langkah berikutnya: jalankan scripts/migrasi-dari-a.mjs dengan file ini (simulasi dulu, lalu --apply).');
    out(lines.join('\n'));
    return 0;
  } catch (e) {
    out(`Gagal: ${e.message}`);
    return 1;
  }
}
