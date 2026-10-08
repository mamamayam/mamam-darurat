import { describe, it, expect } from 'vitest';
import { ADDITION_STATUS, normalizeStatus, isCountedAddition, isPendingAddition, countPendingAdditions } from './additionApproval.js';

describe('status persetujuan Tambahan', () => {
  it('hanya "disetujui" yang dihitung di gaji', () => {
    expect(isCountedAddition({ status: 'disetujui' })).toBe(true);
    expect(isCountedAddition({ status: 'menunggu' })).toBe(false);
    expect(isCountedAddition({ status: 'ditolak' })).toBe(false);
  });

  it('data lama tanpa kolom status / status kosong dianggap disetujui (angka gaji lama tidak berubah)', () => {
    expect(isCountedAddition({})).toBe(true);
    expect(isCountedAddition({ status: null })).toBe(true);
    expect(isCountedAddition({ status: undefined })).toBe(true);
    expect(normalizeStatus('apa-saja')).toBe(ADDITION_STATUS.APPROVED);
  });

  it('menghitung pengajuan yang menunggu', () => {
    const list = [{ status: 'menunggu' }, { status: 'disetujui' }, { status: 'menunggu' }, { status: 'ditolak' }, {}];
    expect(countPendingAdditions(list)).toBe(2);
    expect(isPendingAddition({ status: 'menunggu' })).toBe(true);
    expect(countPendingAdditions(undefined)).toBe(0);
  });
});
