import { describe, it, expect } from 'vitest';
import { readSavedNav, saveNav, clearNav, NAV_KEY } from './navPersist';

const memStore = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
const valid = (v) => ['beranda', 'kasir', 'payroll', 'pelanggan'].includes(v);

describe('navPersist', () => {
  it('menyimpan lalu membaca layar + riwayat sub-layar', () => {
    const s = memStore(); saveNav('pelanggan', ['kasir'], s);
    expect(readSavedNav(valid, s)).toEqual({ view: 'pelanggan', history: ['kasir'] });
  });
  it('tidak ada / rusak / layar tak dikenal -> null', () => {
    expect(readSavedNav(valid, memStore())).toBeNull();
    expect(readSavedNav(valid, memStore({ [NAV_KEY]: '{rusak' }))).toBeNull();
    expect(readSavedNav(valid, memStore({ [NAV_KEY]: JSON.stringify({ view: 'hilang', history: [] }) }))).toBeNull();
  });
  it('riwayat yang tak dikenal dibuang, sisanya tetap', () => {
    const s = memStore({ [NAV_KEY]: JSON.stringify({ view: 'kasir', history: ['hilang', 'payroll', 7] }) });
    expect(readSavedNav(valid, s)).toEqual({ view: 'kasir', history: ['payroll'] });
  });
  it('clearNav (sesi berakhir): layar tersimpan hilang, masuk lagi mulai dari Beranda', () => {
    const s = memStore(); saveNav('pelanggan', ['kasir'], s);
    clearNav(s);
    expect(readSavedNav(valid, s)).toBeNull();
  });
  it('storage tidak tersedia tidak melempar error', () => {
    expect(() => clearNav(null)).not.toThrow();
    expect(() => saveNav('kasir', [], null)).not.toThrow();
    expect(readSavedNav(valid, null)).toBeNull();
  });
});
