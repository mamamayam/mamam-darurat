#!/usr/bin/env node
/**
 * connect-absensi.mjs — menyambungkan C ke database absensi TANPA menempel kunci di chat.
 *
 * Yang dilakukan:
 *   1. Mencari file .env milik app lama (mamam-absensi / mamam-global) di folder-folder
 *      sebelah folder mamam-darurat.
 *   2. Membaca VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY dari sana.
 *   3. Menyalinnya ke .env.local milik C sebagai VITE_ABSENSI_SUPABASE_URL dan
 *      VITE_ABSENSI_SUPABASE_ANON_KEY. Baris lain di .env.local TIDAK disentuh.
 *
 * Cara pakai (PowerShell), DARI folder mamam-darurat:
 *   node "C:\path\ke\connect-absensi.mjs"
 * Kalau file .env-nya tidak ketemu otomatis, tunjukkan sendiri:
 *   node "C:\path\ke\connect-absensi.mjs" "C:\...\mamam-absensi\.env"
 *
 * Kunci TIDAK pernah dicetak ke layar. Skrip menolak kalau:
 *   - kuncinya service_role / secret (kunci rahasia tidak boleh masuk frontend),
 *   - URL-nya sama dengan project C sendiri (berarti salah project).
 */
import fs from 'node:fs';
import path from 'node:path';

const CWD = process.cwd();
const ENV_FILES = ['.env', '.env.local', '.env.production'];
const SOURCE_URL = 'VITE_SUPABASE_URL';
const SOURCE_KEY = 'VITE_SUPABASE_ANON_KEY';
const TARGET_URL = 'VITE_ABSENSI_SUPABASE_URL';
const TARGET_KEY = 'VITE_ABSENSI_SUPABASE_ANON_KEY';

const fail = (msg) => { console.error('\n✗ ' + msg + '\n'); process.exit(1); };

/** Baca file env jadi objek. Tahan BOM, CRLF, komentar, "export", dan tanda kutip. */
function parseEnv(text) {
  const out = {};
  for (let line of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
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

/** URL bersih: tanpa /rest/v1 dan tanpa garis miring di ujung. */
function cleanUrl(u) {
  return String(u || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

/** Jenis kunci: 'anon' | 'publishable' | 'secret' | 'unknown'. */
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
    } catch { /* bukan JWT yang valid */ }
  }
  return 'unknown';
}

const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
const maskHost = (u) => { const h = hostOf(u); return h ? h.slice(0, 4) + '…' + h.slice(h.indexOf('.')) : '(tidak terbaca)'; };

/** Cari kandidat file env: argumen dari pengguna, atau folder sebelah yang namanya mengandung absensi/global. */
function candidates(argPath) {
  if (argPath) return [path.resolve(argPath)];
  const parent = path.dirname(CWD);
  let dirs = [];
  try { dirs = fs.readdirSync(parent, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { /* abaikan */ }
  const rank = (n) => (/absensi/i.test(n) ? 0 : /global/i.test(n) ? 1 : 9);
  const picked = dirs.filter((n) => rank(n) < 9 && path.join(parent, n) !== CWD).sort((a, b) => rank(a) - rank(b));
  const list = [];
  for (const d of picked) for (const f of ENV_FILES) list.push(path.join(parent, d, f));
  return list;
}

function main() {
  const argPath = process.argv[2];
  const searched = candidates(argPath);
  let found = null;
  for (const file of searched) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const env = parseEnv(fs.readFileSync(file, 'utf8'));
    if (env[SOURCE_URL] && env[SOURCE_KEY]) { found = { file, env }; break; }
  }
  if (!found) {
    fail('File .env yang berisi ' + SOURCE_URL + ' dan ' + SOURCE_KEY + ' tidak ketemu.\n' +
      (searched.length ? 'Yang sudah dicari:\n  - ' + searched.join('\n  - ') : 'Tidak ada folder mamam-absensi / mamam-global di sebelah ' + CWD) +
      '\n\nTunjukkan file-nya sendiri:\n  node connect-absensi.mjs "C:\\...\\mamam-absensi\\.env"');
  }

  const url = cleanUrl(found.env[SOURCE_URL]);
  const key = found.env[SOURCE_KEY].trim();
  if (!/^https:\/\//i.test(url)) fail('Isi ' + SOURCE_URL + ' di ' + found.file + ' bukan alamat https. Tidak ada yang diubah.');

  const kind = keyKind(key);
  if (kind === 'secret') fail('Kunci di ' + found.file + ' adalah kunci RAHASIA (service_role/secret). Itu tidak boleh dipakai di frontend. Tidak ada yang diubah.\nPakai kunci "anon" / "publishable" saja.');
  if (kind === 'unknown') fail('Bentuk kunci di ' + found.file + ' tidak dikenali sebagai anon key. Tidak ada yang diubah.');

  const target = path.join(CWD, '.env.local');
  const existingText = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const own = parseEnv(existingText);
  if (own.VITE_SUPABASE_URL && hostOf(cleanUrl(own.VITE_SUPABASE_URL)) === hostOf(url)) {
    fail('URL di ' + found.file + ' SAMA dengan project C sendiri (' + maskHost(url) + ').\nUntuk absensi harus project A (yang lama). Mungkin file yang terpilih salah; tunjukkan file-nya sendiri.');
  }

  const kept = existingText.replace(/^\uFEFF/, '').split(/\r?\n/)
    .filter((l) => !new RegExp('^\\s*(export\\s+)?(' + TARGET_URL + '|' + TARGET_KEY + ')\\s*=').test(l));
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  const next = [...kept, ...(kept.length ? [''] : []),
    '# Sumber absensi (project A) — BACA-SAJA. Disalin otomatis oleh connect-absensi.mjs',
    TARGET_URL + '=' + url,
    TARGET_KEY + '=' + key, ''].join('\n');
  fs.writeFileSync(target, next, { encoding: 'utf8' });   // utf8 tanpa BOM

  console.log('\n✓ Tersambung. Disalin dari: ' + found.file);
  console.log('  Project absensi : ' + maskHost(url));
  console.log('  Jenis kunci     : ' + kind + ' (' + key.length + ' karakter, tidak ditampilkan)');
  console.log('  Ditulis ke      : ' + target + '  (baris lain tidak diubah)');
  console.log('\nLangkah berikut: matikan npm run dev (Ctrl+C), jalankan lagi, lalu buka layar Absensi.\n');
}

main();
