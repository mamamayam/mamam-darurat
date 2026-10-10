import { describe, it, expect } from 'vitest';
import { isUuid, deviceCode, readOrCreateId, readCachedStatus, newUuid } from './deviceId';

const memStore = (init = {}) => {
  const m = { ...init };
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, _m: m };
};

describe('deviceId', () => {
  it('newUuid menghasilkan UUID valid dan unik', () => {
    const a = newUuid(); const b = newUuid();
    expect(isUuid(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('deviceCode: 8 karakter hex pertama, huruf besar, format XXXX-XXXX', () => {
    expect(deviceCode('7f3a92b1-0000-4000-8000-000000000000')).toBe('7F3A-92B1');
    expect(deviceCode('')).toBe('0000-0000');
  });

  it('readOrCreateId: membuat sekali lalu memakai yang tersimpan', () => {
    const st = memStore();
    const first = readOrCreateId(st);
    expect(isUuid(first)).toBe(true);
    expect(readOrCreateId(st, () => { throw new Error('tidak boleh membuat lagi'); })).toBe(first);
  });

  it('readOrCreateId: nilai rusak diganti, penyimpanan diblokir tetap menghasilkan ID', () => {
    const st = memStore({ 'mamam-pos-device-id': 'bukan-uuid' });
    expect(isUuid(readOrCreateId(st))).toBe(true);
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(isUuid(readOrCreateId(blocked))).toBe(true);
    expect(isUuid(readOrCreateId(null))).toBe(true);
  });

  it('readCachedStatus: hanya untuk ID yang sama', () => {
    const st = memStore({ 'mamam-pos-device-status': JSON.stringify({ id: 'x1', status: 'terdaftar' }) });
    expect(readCachedStatus(st, 'x1')).toBe('terdaftar');
    expect(readCachedStatus(st, 'x2')).toBeNull();
    expect(readCachedStatus(memStore({ 'mamam-pos-device-status': '{rusak' }), 'x1')).toBeNull();
  });
});
