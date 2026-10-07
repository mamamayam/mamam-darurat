#!/usr/bin/env node
/**
 * bump-version — naikkan versi di package.json (+ package-lock.json) dari pesan commit.
 * Dijalankan GitHub Action tiap push ke main; bisa juga dicoba manual di laptop.
 *
 *   node scripts/bump-version.mjs --range <sebelum>..<sesudah>   commit dalam rentang itu
 *   node scripts/bump-version.mjs --message "feat: tambah X"      satu pesan langsung (uji coba)
 *   tambahkan --dry-run untuk hanya menampilkan hasil tanpa menulis file
 *
 * Aturan kenaikan ada di scripts/versioning.mjs. Kalau berjalan di GitHub Actions,
 * hasilnya ditulis ke $GITHUB_OUTPUT (bumped, version, level).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planBump } from './versioning.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const ZERO = /^0{40}$/;

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] ?? null; };
const dryRun = args.includes('--dry-run');

const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function messagesFromRange(range) {
  const [before, after] = range.split('..');
  if (!after) throw new Error(`--range harus berbentuk <sebelum>..<sesudah>, dapat "${range}"`);
  // Push pertama / force-push: commit "sebelum" tidak ada atau nol semua -> hitung commit terakhir saja.
  const usable = before && !ZERO.test(before) && (() => { try { git('cat-file', '-e', `${before}^{commit}`); return true; } catch { return false; } })();
  const log = usable ? git('log', '--format=%B%x00', `${before}..${after}`) : git('log', '-1', '--format=%B%x00', after);
  return log.split('\0').map((s) => s.trim()).filter(Boolean);
}

function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function writeJson(file, data, original) {
  const trailing = /\n$/.test(original) ? '\n' : '';
  writeFileSync(file, JSON.stringify(data, null, 2) + trailing);
}

function setOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join(''));
}

const range = opt('--range');
const message = opt('--message');
if (!range && message == null) { console.error('Pakai --range <a..b> atau --message "<teks>"'); process.exit(2); }

const messages = message != null ? [message] : messagesFromRange(range);
const pkgPath = `${root}package.json`;
const pkgText = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgText);
const plan = planBump(pkg.version, messages);

if (!plan) {
  console.log(`Tidak ada kenaikan versi (tetap ${pkg.version}).`);
  setOutput({ bumped: 'false', version: pkg.version });
  process.exit(0);
}

console.log(`${pkg.version} -> ${plan.next} (${plan.level})${dryRun ? ' [dry-run]' : ''}`);
if (!dryRun) {
  writeJson(pkgPath, { ...pkg, version: plan.next }, pkgText);
  const lockPath = `${root}package-lock.json`;
  if (existsSync(lockPath)) {
    const lockText = readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(lockText);
    lock.version = plan.next;
    if (lock.packages && lock.packages['']) lock.packages[''].version = plan.next;
    writeJson(lockPath, lock, lockText);
  }
}
setOutput({ bumped: 'true', version: plan.next, level: plan.level });
