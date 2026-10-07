import { describe, it, expect } from 'vitest';
import { commitLevel, highestLevel, bumpVersion, planBump, isReleaseCommit } from './versioning.mjs';

describe('commitLevel (awalan pesan commit -> besar/kecil)', () => {
  it('feat = minor', () => { expect(commitLevel('feat: tambah Rincian Pengeluaran')).toBe('minor'); expect(commitLevel('feat(laporan): tab baru')).toBe('minor'); });
  it('tanda ! atau BREAKING CHANGE = major', () => {
    expect(commitLevel('feat!: ganti skema')).toBe('major');
    expect(commitLevel('refactor(db)!: ubah tabel')).toBe('major');
    expect(commitLevel('fix: x\n\nBREAKING CHANGE: PIN diganti')).toBe('major');
    expect(commitLevel('fix: x\n\nBREAKING-CHANGE: PIN diganti')).toBe('major');
  });
  it('fix, refactor, chore, docs, dll = patch', () => {
    for (const m of ['fix: bug kasbon', 'refactor: rapikan', 'chore: bersih-bersih', 'docs: catatan', 'perf: cepat', 'style: spasi', 'test: tambah']) expect(commitLevel(m)).toBe('patch');
  });
  it('pesan tanpa awalan (mis. "push 7/10 v2") tetap patch', () => {
    expect(commitLevel('push 7/10 v2')).toBe('patch');
    expect(commitLevel('Merge branch main')).toBe('patch');
  });
  it('awalan huruf besar tetap dikenali; "feature" bukan feat', () => {
    expect(commitLevel('Feat: x')).toBe('minor');
    expect(commitLevel('feature: x')).toBe('patch');
  });
  it('commit rilis otomatis & pesan kosong tidak dihitung', () => {
    expect(commitLevel('chore(release): v1.2.3')).toBeNull();
    expect(commitLevel('')).toBeNull(); expect(commitLevel(null)).toBeNull(); expect(commitLevel('   ')).toBeNull();
    expect(isReleaseCommit('chore(release): v1.2.3')).toBe(true); expect(isReleaseCommit('chore: x')).toBe(false);
  });
  it('hanya baris pertama yang menentukan awalan', () => {
    expect(commitLevel('push 7/10\n\nfeat: di badan pesan')).toBe('patch');
  });
});

describe('highestLevel (satu push, banyak commit)', () => {
  it('ambil yang tertinggi', () => {
    expect(highestLevel(['fix: a', 'feat: b', 'chore: c'])).toBe('minor');
    expect(highestLevel(['fix: a', 'feat!: b', 'feat: c'])).toBe('major');
    expect(highestLevel(['fix: a', 'push 7/10'])).toBe('patch');
  });
  it('commit rilis diabaikan; kosong = null', () => {
    expect(highestLevel(['chore(release): v1.0.1'])).toBeNull();
    expect(highestLevel([])).toBeNull();
    expect(highestLevel(['chore(release): v1.0.1', 'fix: a'])).toBe('patch');
  });
});

describe('bumpVersion', () => {
  it('patch / minor / major mengosongkan angka di bawahnya', () => {
    expect(bumpVersion('1.4.7', 'patch')).toBe('1.4.8');
    expect(bumpVersion('1.4.7', 'minor')).toBe('1.5.0');
    expect(bumpVersion('1.4.7', 'major')).toBe('2.0.0');
  });
  it('angka dua digit naik normal (bukan desimal)', () => { expect(bumpVersion('0.9.99', 'patch')).toBe('0.9.100'); expect(bumpVersion('0.9.9', 'minor')).toBe('0.10.0'); });
  it('akhiran pra-rilis dibuang; versi / level tidak valid melempar galat', () => {
    expect(bumpVersion('1.2.3-beta.1', 'patch')).toBe('1.2.4');
    expect(() => bumpVersion('abc', 'patch')).toThrow(); expect(() => bumpVersion('1.2.3', 'mega')).toThrow(); expect(() => bumpVersion(undefined, 'patch')).toThrow();
  });
});

describe('planBump', () => {
  it('menghasilkan level + versi berikutnya', () => { expect(planBump('0.1.0', ['feat: x'])).toEqual({ level: 'minor', next: '0.2.0' }); });
  it('tanpa commit yang dihitung = null (tidak naik)', () => { expect(planBump('0.1.0', ['chore(release): v0.1.0'])).toBeNull(); });
});
