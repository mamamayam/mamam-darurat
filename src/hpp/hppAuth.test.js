import { describe, it, expect } from 'vitest';
import { DEMO_EMAIL, DEMO_PASSWORD, clearSession, readSession, saveSession, validateLogin } from './hppAuth';
import { TABS, pathForTab, tabFromPath } from './hppRoutes';

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

describe('login dummy', () => {
  it('kredensial benar = boleh masuk (huruf besar/kecil email dan spasi diabaikan)', () => {
    expect(validateLogin(DEMO_EMAIL, DEMO_PASSWORD)).toBeNull();
    expect(validateLogin('  Owner@Mamam.test ', DEMO_PASSWORD)).toBeNull();
  });
  it('kosong = minta diisi; salah = pesan salah', () => {
    expect(validateLogin('', DEMO_PASSWORD)).toBe('Isi email dan password');
    expect(validateLogin(DEMO_EMAIL, '')).toBe('Isi email dan password');
    expect(validateLogin(DEMO_EMAIL, 'salah')).toMatch(/salah/);
    expect(validateLogin('lain@mamam.test', DEMO_PASSWORD)).toMatch(/salah/);
  });
  it('sesi disimpan, dibaca, dihapus; storage rusak tidak melempar galat', () => {
    const s = fakeStorage();
    expect(readSession(s)).toBeNull();
    saveSession(DEMO_EMAIL, s);
    expect(readSession(s)).toBe(DEMO_EMAIL);
    clearSession(s);
    expect(readSession(s)).toBeNull();
    const rusak = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    expect(() => { saveSession(DEMO_EMAIL, rusak); clearSession(rusak); }).not.toThrow();
    expect(readSession(rusak)).toBeNull();
  });
  it('nilai sesi sembarang di storage tidak dianggap login', () => {
    const s = fakeStorage(); s.setItem('mamam-hpp-dummy-session', 'orang@lain.com');
    expect(readSession(s)).toBeNull();
  });
});

describe('route tab', () => {
  it('path ke tab dan sebaliknya', () => {
    expect(tabFromPath('/hpp')).toBe('bahan');
    expect(tabFromPath('/hpp/')).toBe('bahan');
    expect(tabFromPath('/hpp/resep')).toBe('resep');
    expect(tabFromPath('/hpp/menu/')).toBe('menu');
    expect(tabFromPath('/hpp/apa-saja')).toBe('bahan');
    for (const t of TABS) expect(tabFromPath(pathForTab(t.key))).toBe(t.key);
  });
});
