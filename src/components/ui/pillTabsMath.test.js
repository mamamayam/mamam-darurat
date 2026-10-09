import { describe, it, expect } from 'vitest';
import { pillIndex, pillIndicatorStyle } from './pillTabsMath';

const OPTS = [{ value: 'semua' }, { value: 'karyawan' }, { value: 'toko' }];

describe('pillIndex', () => {
  it('mengembalikan urutan tab yang aktif', () => {
    expect(pillIndex(OPTS, 'semua')).toBe(0);
    expect(pillIndex(OPTS, 'karyawan')).toBe(1);
    expect(pillIndex(OPTS, 'toko')).toBe(2);
  });

  it('-1 kalau value tidak ada di options', () => {
    expect(pillIndex(OPTS, 'lain')).toBe(-1);
    expect(pillIndex([], 'semua')).toBe(-1);
  });
});

describe('pillIndicatorStyle', () => {
  it('tab pertama: tidak bergeser', () => {
    expect(pillIndicatorStyle(0, 3)).toEqual({ width: 'calc(100% / 3)', transform: 'translateX(0%)' });
  });

  it('tab berikutnya bergeser sejauh index kali lebar indikator', () => {
    expect(pillIndicatorStyle(1, 3).transform).toBe('translateX(100%)');
    expect(pillIndicatorStyle(2, 3).transform).toBe('translateX(200%)');
  });

  it('dua tab: indikator separuh lebar', () => {
    expect(pillIndicatorStyle(1, 2)).toEqual({ width: 'calc(100% / 2)', transform: 'translateX(100%)' });
  });

  it('satu tab: indikator penuh', () => {
    expect(pillIndicatorStyle(0, 1)).toEqual({ width: 'calc(100% / 1)', transform: 'translateX(0%)' });
  });

  it('index tidak valid atau tanpa tab: indikator disembunyikan (lebar 0)', () => {
    expect(pillIndicatorStyle(-1, 3).width).toBe('0%');
    expect(pillIndicatorStyle(0, 0).width).toBe('0%');
  });
});
