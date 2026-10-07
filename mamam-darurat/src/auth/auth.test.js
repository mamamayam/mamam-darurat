import { describe, it, expect } from 'vitest';
import {
  roleForPin, recordAttempt, initialAttempts, isLocked, secondsLeft, attemptsLeft,
  readAttempts, makeSession, readSession, MAX_ATTEMPTS, LOCK_MS, SESSION_MS,
} from './authLogic.js';
import { can, canOpenView, PERMISSIONS, VIEW_PERMISSION, ROLES, roleLabel } from './permissions.js';

describe('roleForPin', () => {
  it('PIN owner dan staf dikenali', () => { expect(roleForPin('3678')).toBe('owner'); expect(roleForPin('0000')).toBe('staff'); });
  it('PIN salah / kosong / bukan 4 digit ditolak', () => {
    for (const bad of ['1111', '', '367', '36780', 'abcd', '36 8', null, undefined, 3678]) {
      if (bad === 3678) expect(roleForPin(bad)).toBe('owner');       // angka 3678 jadi "3678" -> sah
      else expect(roleForPin(bad)).toBeNull();
    }
  });
  it('angka depan nol tetap utuh (0000 bukan 0)', () => { expect(roleForPin('0000')).toBe('staff'); expect(roleForPin(0)).toBeNull(); });
});

describe('batas percobaan', () => {
  it('salah berkali-kali: terkunci tepat pada percobaan ke-5', () => {
    let st = initialAttempts();
    for (let i = 1; i < MAX_ATTEMPTS; i++) { st = recordAttempt(st, false, 1000); expect(isLocked(st, 1000)).toBe(false); expect(attemptsLeft(st)).toBe(MAX_ATTEMPTS - i); }
    st = recordAttempt(st, false, 1000);
    expect(isLocked(st, 1000)).toBe(true); expect(secondsLeft(st, 1000)).toBe(30);
  });
  it('kunci terbuka sendiri setelah 30 detik, hitungan mulai dari nol', () => {
    let st = initialAttempts(); for (let i = 0; i < MAX_ATTEMPTS; i++) st = recordAttempt(st, false, 0);
    expect(isLocked(st, LOCK_MS - 1)).toBe(true); expect(isLocked(st, LOCK_MS)).toBe(false);
    expect(attemptsLeft(st)).toBe(MAX_ATTEMPTS);
  });
  it('saat terkunci, percobaan diabaikan (tidak memperpanjang kunci, tidak menambah gagal)', () => {
    let st = initialAttempts(); for (let i = 0; i < MAX_ATTEMPTS; i++) st = recordAttempt(st, false, 0);
    expect(recordAttempt(st, false, 10000)).toEqual(st); expect(recordAttempt(st, true, 10000)).toEqual(st);
  });
  it('berhasil masuk mereset hitungan gagal', () => {
    let st = recordAttempt(recordAttempt(initialAttempts(), false, 0), false, 0);
    expect(recordAttempt(st, true, 5)).toEqual(initialAttempts());
  });
  it('readAttempts: data rusak / janggal diabaikan', () => {
    expect(readAttempts('bukan json', 0)).toEqual(initialAttempts());
    expect(readAttempts(JSON.stringify({ fails: 'x', lockedUntil: 1 }), 0)).toEqual(initialAttempts());
    expect(readAttempts(JSON.stringify({ fails: 3, lockedUntil: 0 }), 0)).toEqual({ fails: 3, lockedUntil: 0 });
    expect(readAttempts(JSON.stringify({ fails: 0, lockedUntil: 10 ** 15 }), 0)).toEqual(initialAttempts());   // kunci "selamanya" dibuang
    expect(readAttempts(JSON.stringify({ fails: 99, lockedUntil: 0 }), 0)).toEqual(initialAttempts());
    expect(readAttempts(null, 0)).toEqual(initialAttempts());
  });
});

describe('sesi', () => {
  const now = 1_000_000_000_000;
  it('sesi segar dibaca', () => { expect(readSession(makeSession('owner', now), now + 1000)).toBe('owner'); expect(readSession(makeSession('staff', now), now)).toBe('staff'); });
  it('kedaluwarsa setelah 12 jam', () => {
    expect(readSession(makeSession('staff', now), now + SESSION_MS)).toBe('staff');
    expect(readSession(makeSession('staff', now), now + SESSION_MS + 1)).toBeNull();
  });
  it('rusak / peran asing / tanpa waktu / dari masa depan ditolak', () => {
    expect(readSession('xx', now)).toBeNull(); expect(readSession(null, now)).toBeNull();
    expect(readSession(JSON.stringify({ role: 'admin', at: now }), now)).toBeNull();
    expect(readSession(JSON.stringify({ role: 'owner' }), now)).toBeNull();
    expect(readSession(JSON.stringify({ role: 'owner', at: now + 10 * 60 * 1000 }), now)).toBeNull();
  });
});

describe('izin', () => {
  const OWNER_ONLY = Object.keys(PERMISSIONS);
  it('owner boleh semua izin yang terdaftar', () => { for (const p of OWNER_ONLY) expect(can('owner', p)).toBe(true); });
  it('staf DITOLAK untuk semua izin yang terdaftar (daftar default = owner-only)', () => { for (const p of OWNER_ONLY) expect(can('staff', p)).toBe(false); });
  it('izin yang tidak terdaftar ditolak untuk semua (aman secara bawaan)', () => { expect(can('owner', 'izin.ngawur')).toBe(false); expect(can('staff', 'izin.ngawur')).toBe(false); });
  it('tanpa peran / peran asing ditolak', () => { expect(can(null, 'laporan.labaRugi')).toBe(false); expect(can('admin', 'laporan.labaRugi')).toBe(false); expect(can(undefined, 'beranda.laba')).toBe(false); });
  it('layar: Penggajian, Manajemen Menu, Riwayat, Laporan owner-only; layar lain terbuka untuk semua yang login', () => {
    for (const v of ['penggajian', 'menu', 'riwayat', 'laporan']) { expect(canOpenView('staff', v)).toBe(false); expect(canOpenView('owner', v)).toBe(true); }
    for (const v of ['beranda', 'kasir', 'dompet', 'pelanggan', 'pengeluaran', 'karyawan', 'absensi']) { expect(canOpenView('staff', v)).toBe(true); expect(canOpenView('owner', v)).toBe(true); }
  });
  it('setiap layar terbatas merujuk izin yang benar-benar ada', () => { for (const perm of Object.values(VIEW_PERMISSION)) expect(PERMISSIONS[perm]).toBeDefined(); });
  it('peran & label', () => { expect(ROLES).toEqual(['owner', 'staff']); expect(roleLabel('owner')).toBe('Owner'); expect(roleLabel('staff')).toBe('Staf'); });
});

// ---------------------------------------------------------------------------
// Pagar jaga: kunci izin yang dipakai di kode HARUS terdaftar. Izin yang tidak
// terdaftar ditolak untuk semua orang (aman), tapi itu berarti fitur diam-diam
// mati untuk owner juga — tes ini menangkap salah ketik seperti itu.
// ---------------------------------------------------------------------------
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name) && !p.includes(join('src', 'auth') + '/') ? [p] : [];
  });
}

describe('kunci izin di kode vs daftar PERMISSIONS', () => {
  const used = new Set();
  for (const file of sourceFiles('src')) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\b(?:can|allowed)\(\s*'([^']+)'\s*\)/g)) used.add(m[1]);
  }
  it('ada kunci izin yang dipakai (tes ini tidak kosong)', () => { expect(used.size).toBeGreaterThanOrEqual(6); });
  it('setiap can(...) di kode terdaftar di PERMISSIONS', () => {
    const missing = [...used].filter((k) => !(k in PERMISSIONS));
    expect(missing).toEqual([]);
  });
  it('setiap izin terdaftar benar-benar dipakai (langsung atau lewat VIEW_PERMISSION)', () => {
    const viaView = new Set(Object.values(VIEW_PERMISSION));
    const unused = Object.keys(PERMISSIONS).filter((k) => !used.has(k) && !viaView.has(k));
    expect(unused).toEqual([]);
  });
});
