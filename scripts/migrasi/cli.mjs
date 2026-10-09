/**
 * cli.mjs — antarmuka perintah untuk migrasi A → C. Dipanggil dari scripts/migrasi-dari-a.mjs.
 *
 * Aturan keselamatan:
 *  - Bawaannya SIMULASI: membaca C dan file backup, menampilkan laporan, tidak menulis apa pun.
 *  - Menulis hanya dengan --apply.
 *  - Hanya menyentuh project C (VITE_SUPABASE_URL). Menolak kalau URL-nya sama dengan database
 *    absensi (yang tidak boleh ditulis) atau kuncinya kunci rahasia.
 *  - Tidak pernah menimpa data C yang sudah ada; aman dijalankan ulang.
 *  - Setiap penulisan dicatat di berkas migrasi-log-*.json, dipakai oleh --batalkan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildPlan, TABLE_ORDER } from './transform.mjs';
import { createClient, ApiError, EXISTING_READ, EXISTING_READ_HISTORY, conflictOf } from './postgrest.mjs';

export const HELP = `
Migrasi data app lama (mamam-global) -> C (mamam-darurat)

Langkah:
  1. Di app lama: Backup & Restore -> Export Data (JSON), rentang tanggal dikosongkan ("semua"). Kirim file-nya ke laptop.
  2. Dari folder mamam-darurat (yang ada .env.local), jalankan SIMULASI dulu:
       node scripts/migrasi-dari-a.mjs "C:\\path\\backup.json"
  3. Kalau laporannya masuk akal, tulis beneran:
       node scripts/migrasi-dari-a.mjs "C:\\path\\backup.json" --apply
  4. Mau riwayat juga (transaksi, pengeluaran, shift lama):
       node scripts/migrasi-dari-a.mjs "C:\\path\\backup.json" --riwayat --apply

Pilihan:
  --apply            tulis ke database (tanpa ini hanya simulasi)
  --riwayat          ikutkan transaksi, pengeluaran, pemasukan lain, dan riwayat shift
  --batalkan <log>   hapus data yang ditulis pelarian sebelumnya (pakai berkas migrasi-log-*.json);
                     tanpa --apply hanya menampilkan apa yang akan dihapus
  --env <file>       pakai file env selain .env.local
  --help             tampilkan bantuan ini

Aman dijalankan berulang: data yang sudah ada di C tidak ditimpa dan tidak digandakan.
`;

const LABEL = {
  categories: 'Kategori menu', menu_items: 'Menu', variant_categories: 'Kategori varian',
  variant_groups: 'Grup varian', variant_options: 'Opsi varian', menu_item_variant_groups: 'Koneksi menu-varian',
  customers: 'Pelanggan', vouchers: 'Voucher', employees: 'Karyawan', expense_categories: 'Kategori pengeluaran',
  transactions: 'Transaksi', transaction_items: 'Item transaksi', expenses: 'Pengeluaran/pemasukan', shifts: 'Shift (riwayat)',
};
const READ_LABEL = {
  menus: 'menu', categories: 'kategori', variantGroups: 'grup varian', customers: 'pelanggan', vouchers: 'voucher',
  employees: 'karyawan', salesHistory: 'transaksi', expenses: 'pengeluaran', incomes: 'pemasukan lain', shiftHistory: 'shift',
};

// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const o = { file: null, apply: false, riwayat: false, undoFile: null, envFile: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--riwayat') o.riwayat = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--batalkan') { o.undoFile = argv[++i] ?? ''; if (!o.undoFile || o.undoFile.startsWith('--')) throw new Error('--batalkan perlu nama berkas log, mis. --batalkan migrasi-log-20261004-1530.json'); }
    else if (a === '--env') { o.envFile = argv[++i] ?? ''; if (!o.envFile || o.envFile.startsWith('--')) throw new Error('--env perlu nama file.'); }
    else if (a.startsWith('--')) throw new Error(`Pilihan tidak dikenal: ${a}. Ketik --help untuk bantuan.`);
    else if (o.file === null) o.file = a;
    else throw new Error(`Argumen berlebih: ${a}. Kalau path-nya mengandung spasi, apit dengan tanda kutip.`);
  }
  return o;
}

export function parseEnv(textIn) {
  const out = {};
  for (let line of String(textIn).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    line = line.replace(/^export\s+/, '');
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[k] = v.trim();
  }
  return out;
}

const cleanUrl = (u) => String(u || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
const maskHost = (u) => { const h = hostOf(u); return h ? `${h.slice(0, 4)}…${h.slice(h.indexOf('.'))}` : '(tidak terbaca)'; };

function keyKind(key) {
  const k = String(key || '').trim();
  if (k.startsWith('sb_secret_')) return 'secret';
  if (k.startsWith('sb_publishable_')) return 'publishable';
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      if (payload.role === 'anon') return 'anon';
      if (payload.role === 'service_role') return 'secret';
    } catch { /* bukan JWT */ }
  }
  return 'unknown';
}

/** Baca .env.local. Mengembalikan { url, key } atau null kalau tidak ada; melempar kalau berbahaya/salah. */
export function loadTarget(envPath, { explicit = false } = {}) {
  if (!fs.existsSync(envPath)) {
    if (explicit) throw new Error(`File env tidak ditemukan: ${envPath}`);
    return null;
  }
  const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
  const url = cleanUrl(env.VITE_SUPABASE_URL);
  const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) throw new Error(`${envPath} belum berisi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY (project C).`);
  if (!/^https?:\/\//i.test(url)) throw new Error('VITE_SUPABASE_URL harus berupa alamat https://… (tanpa /rest/v1/).');
  if (keyKind(key) === 'secret') throw new Error('Kunci di .env.local adalah kunci RAHASIA (service_role/secret). Itu tidak boleh dipakai di aplikasi frontend. Ganti dengan kunci "anon"/"publishable" lalu coba lagi.');
  const absensi = cleanUrl(env.VITE_ABSENSI_SUPABASE_URL);
  if (absensi && hostOf(absensi) === hostOf(url)) {
    throw new Error('VITE_SUPABASE_URL sama dengan VITE_ABSENSI_SUPABASE_URL. Database absensi TIDAK BOLEH ditulis. Periksa .env.local: URL C harus project C sendiri.');
  }
  return { url, key };
}

// ---------------------------------------------------------------------------

export function formatReport(plan, { apply, offline, host, scope }) {
  const L = [];
  L.push('');
  L.push(apply ? '=== MIGRASI A → C: MENULIS KE DATABASE ===' : '=== MIGRASI A → C: SIMULASI (belum ada yang ditulis) ===');
  L.push(`Target : ${offline ? '(belum terhubung ke C)' : host}`);
  L.push(`Cakupan: ${scope}`);
  L.push('');
  const readParts = Object.entries(READ_LABEL).filter(([k]) => plan.read[k] !== undefined).map(([k, n]) => `${n} ${plan.read[k]}`);
  L.push(`Dibaca dari file backup: ${readParts.join(' · ') || '(kosong)'}`);
  L.push('');
  L.push('Tabel                         Baru   Sudah ada di C');
  L.push('---------------------------  ------  --------------');
  for (const t of TABLE_ORDER) {
    const s = plan.stats[t];
    if (!s) continue;
    L.push(`${(LABEL[t] ?? t).padEnd(27)}  ${String(s.baru).padStart(6)}  ${String(s.sudahAda).padStart(14)}`);
  }
  if (Object.keys(plan.stats).length === 0) L.push('(tidak ada data)');
  if (plan.skipped.length > 0) {
    L.push('');
    L.push(`Dilewati: ${plan.skipped.length}`);
    const bySection = new Map();
    for (const s of plan.skipped) { if (!bySection.has(s.section)) bySection.set(s.section, []); bySection.get(s.section).push(s); }
    for (const [section, list] of bySection) {
      L.push(`  [${section}] ${list.length}`);
      for (const s of list.slice(0, 6)) L.push(`    - ${s.label}: ${s.reason}`);
      if (list.length > 6) L.push(`    … dan ${list.length - 6} lainnya`);
    }
  }
  if (plan.notes.length > 0) {
    L.push('');
    L.push('Catatan:');
    for (const n of plan.notes) L.push(`  • ${n}`);
  }
  L.push('');
  return L.join('\n');
}

/** Peringatan kalau ada data riwayat yang lebih baru dari shift yang sedang terbuka di C. */
export function openShiftWarning(plan, existingShifts) {
  const open = (existingShifts || []).filter((s) => !s.closed_at).map((s) => new Date(s.opened_at).getTime()).filter(Number.isFinite);
  if (open.length === 0) return null;
  const openedAt = Math.max(...open);
  let newest = -Infinity;
  for (const g of plan.inserts) {
    if (g.table === 'transactions') for (const r of g.rows) newest = Math.max(newest, new Date(r.paid_at).getTime());
    if (g.table === 'expenses') for (const r of g.rows) newest = Math.max(newest, new Date(r.created_at).getTime());
  }
  if (newest >= openedAt) {
    return 'PERHATIAN: ada transaksi/pengeluaran lama yang waktunya LEBIH BARU dari shift yang sedang terbuka di C. Itu akan ikut terhitung di shift tersebut. Tutup shift C dulu, atau pastikan backup diambil sebelum shift C dibuka.';
  }
  return null;
}

// ---------------------------------------------------------------------------

export async function run(argv, { cwd = process.cwd(), log = console.log, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  let args;
  try { args = parseArgs(argv); } catch (err) { log(`\n✗ ${err.message}\n`); return 1; }
  if (args.help || (!args.file && !args.undoFile)) { log(HELP); return args.help ? 0 : 1; }

  try {
    const envPath = path.resolve(cwd, args.envFile ?? '.env.local');
    const target = loadTarget(envPath, { explicit: Boolean(args.envFile) });
    const client = target ? createClient({ url: target.url, key: target.key, fetchImpl }) : null;
    if (args.undoFile) return await undo(args, { client, target, cwd, log });

    // --- baca backup --------------------------------------------------------
    const filePath = path.resolve(cwd, args.file);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error(`File backup tidak ditemukan: ${filePath}`);
    let backup;
    try { backup = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')); }
    catch (err) { throw new Error(`File backup bukan JSON yang valid (${err.message}). Pakai file hasil Backup → Export JSON dari app lama.`); }

    // --- baca isi C ---------------------------------------------------------
    if (args.apply && !client) throw new Error(`Tidak bisa menulis: ${envPath} tidak ditemukan. Jalankan dari folder mamam-darurat yang punya .env.local.`);
    const existing = {};
    if (client) {
      log('Membaca isi database C…');
      const spec = { ...EXISTING_READ, ...(args.riwayat ? EXISTING_READ_HISTORY : {}) };
      for (const [table, [cols, order]] of Object.entries(spec)) existing[table] = await client.selectAll(table, cols, order);
    }

    const plan = buildPlan(backup, existing, { withHistory: args.riwayat });
    const scope = args.riwayat ? 'data master + riwayat (transaksi, pengeluaran, shift)' : 'data master saja (menu, varian, pelanggan, voucher, karyawan)';
    const offline = !client;
    log(formatReport(plan, { apply: args.apply, offline, host: target ? maskHost(target.url) : '', scope }));
    if (offline) log('⚠ .env.local tidak ditemukan, jadi isi C belum bisa dibaca: semua dianggap BARU. Jalankan dari folder mamam-darurat untuk hasil yang akurat.\n');
    if (args.riwayat && client) { const w = openShiftWarning(plan, existing.shifts); if (w) log(`⚠ ${w}\n`); }

    const total = plan.inserts.reduce((n, g) => n + g.rows.length, 0);
    if (!args.apply) {
      log(total === 0 ? 'Tidak ada yang perlu ditulis.\n' : `Ini baru simulasi: belum ada yang ditulis.\nKalau sudah oke, jalankan lagi dengan --apply di akhir perintah.\n`);
      return 0;
    }
    if (total === 0) { log('Tidak ada yang perlu ditulis (semuanya sudah ada di C).\n'); return 0; }

    // --- tulis ---------------------------------------------------------------
    const written = {};
    const stamp = now().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
    const logPath = path.join(cwd, `migrasi-log-${stamp}.json`);
    const saveLog = () => {
      if (Object.keys(written).length === 0) return;
      fs.writeFileSync(logPath, JSON.stringify({ tag: 'migrasi-dari-A', createdAt: now().toISOString(), host: maskHost(target.url), withHistory: args.riwayat, tables: written }, null, 2));
    };
    try {
      for (const g of plan.inserts) {
        const pk = conflictOf(g.table);
        const keyCols = pk.split(',');
        written[g.table] ||= [];
        await client.insertIgnore(g.table, g.rows, pk, (chunk) => {
          for (const r of chunk) written[g.table].push(keyCols.length === 1 ? r[pk] : Object.fromEntries(keyCols.map((c) => [c, r[c]])));
        });
        log(`  ✓ ${(LABEL[g.table] ?? g.table).padEnd(24)} ${String(g.rows.length).padStart(6)} baris`);
      }
    } catch (err) {
      log(`\n✗ Berhenti di tengah jalan: ${err.message}`);
      log('  Yang sudah tertulis TIDAK hilang dan aman. Perbaiki penyebabnya lalu jalankan perintah yang sama lagi: bagian yang sudah masuk dilewati otomatis.\n');
      saveLog();
      if (fs.existsSync(logPath)) log(`  Catatan yang sudah ditulis: ${path.basename(logPath)}\n`);
      return 1;
    }
    saveLog();
    log(`\n✓ Selesai. ${total} baris ditulis.`);
    log(`  Catatan penulisan disimpan di ${path.basename(logPath)} (simpan; dipakai kalau mau membatalkan: node scripts/migrasi-dari-a.mjs --batalkan ${path.basename(logPath)} --apply).`);
    log('  Langkah berikut: muat ulang Mamam POS dan periksa Menu, Pelanggan, Karyawan (dan Laporan kalau memakai --riwayat).\n');
    return 0;
  } catch (err) {
    log(`\n✗ ${err.message}\n`);
    return 1;
  }
}

// ---------------------------------------------------------------------------

/** Tabel yang dihapus saat membatalkan (anak ikut terhapus lewat ON DELETE CASCADE). Urutan: anak dulu. */
const UNDO_ORDER = ['shifts', 'expenses', 'transactions', 'expense_categories', 'employees', 'vouchers', 'customers', 'variant_groups', 'variant_categories', 'menu_items', 'categories'];

async function undo(args, { client, target, cwd, log }) {
  const logPath = path.resolve(cwd, args.undoFile);
  if (!fs.existsSync(logPath)) throw new Error(`Berkas log tidak ditemukan: ${logPath}`);
  let data;
  try { data = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch { throw new Error('Berkas log rusak (bukan JSON).'); }
  if (data?.tag !== 'migrasi-dari-A' || !data.tables) throw new Error('Ini bukan berkas log migrasi (migrasi-log-*.json).');
  if (!client) throw new Error('Tidak bisa terhubung ke C: .env.local tidak ditemukan.');
  if (data.host && data.host !== maskHost(target.url)) throw new Error(`Log ini dibuat untuk project ${data.host}, sedangkan .env.local menunjuk ${maskHost(target.url)}. Dibatalkan supaya tidak menghapus di project yang salah.`);

  log(args.apply ? '\n=== MEMBATALKAN MIGRASI: MENGHAPUS DATA ===' : '\n=== BATALKAN MIGRASI: SIMULASI (belum ada yang dihapus) ===');
  let failures = 0;
  for (const table of UNDO_ORDER) {
    const ids = (data.tables[table] || []).filter((x) => typeof x === 'string');
    if (ids.length === 0) continue;
    if (!args.apply) { log(`  ${(LABEL[table] ?? table).padEnd(24)} ${String(ids.length).padStart(6)} baris akan dihapus`); continue; }
    try {
      await client.deleteIn(table, 'id', ids);
      log(`  ✓ ${(LABEL[table] ?? table).padEnd(24)} ${String(ids.length).padStart(6)} baris dihapus`);
    } catch (err) {
      failures += 1;
      log(`  ✗ ${(LABEL[table] ?? table).padEnd(24)} gagal: ${err.message}`);
    }
  }
  if (!args.apply) log('\nKalau sudah yakin, jalankan lagi dengan --apply di akhir perintah.\n');
  else log(failures ? `\n⚠ Selesai dengan ${failures} tabel gagal (biasanya karena datanya sudah dipakai data lain). Yang berhasil tetap terhapus.\n` : '\n✓ Selesai. Data hasil migrasi sudah dihapus.\n');
  return failures ? 1 : 0;
}
