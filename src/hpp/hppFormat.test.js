import { describe, it, expect } from 'vitest';
import { angka, parseAngka, persen, rupiah, tanggal } from './hppFormat';

describe('format', () => {
  it('rupiah', () => {
    expect(rupiah(13622)).toBe('Rp13.622');
    expect(rupiah(1462.4)).toBe('Rp1.462');
    expect(rupiah(-537)).toBe('-Rp537');
    expect(rupiah(null)).toBe('-');
  });
  it('angka dan persen', () => {
    expect(angka(1410.5)).toBe('1.410,5');
    expect(angka(80)).toBe('80');
    expect(persen(29.24)).toBe('29,2%');
    expect(persen(30, 0)).toBe('30%');
  });
  it('tanggal: tahun disembunyikan jika sama dengan tahun berjalan', () => {
    const now = new Date('2026-10-14T00:00:00Z');
    expect(tanggal('2026-10-05T10:00:00Z', now)).toBe('5 Okt');
    expect(tanggal('2025-12-31T12:00:00Z', now)).toBe('31 Des 2025');
    expect(tanggal('bukan tanggal', now)).toBe('-');
  });
  it('parseAngka menerima 45000, 45.000, 45,5; menolak kosong, negatif, huruf', () => {
    expect(parseAngka('45000')).toBe(45000);
    expect(parseAngka('45.000')).toBe(45000);
    expect(parseAngka('1.250.000')).toBe(1250000);
    expect(parseAngka('45,5')).toBe(45.5);
    expect(parseAngka(' 12 000 ')).toBe(12000);
    expect(parseAngka('')).toBeNull();
    expect(parseAngka('-5')).toBeNull();
    expect(parseAngka('abc')).toBeNull();
  });
});
