import { describe, it, expect } from 'vitest';
import { periodLabel, dayHeading, dayShort, groupByDay, sumByDay } from './listFilters';

describe('listFilters', () => {
  it('dayHeading & dayShort membaca tanggal lokal', () => {
    expect(dayHeading('2026-10-10')).toBe('Sabtu, 10 Okt');
    expect(dayShort('2026-01-05')).toBe('5 Jan');
    expect(dayHeading('2026-10-10T23:59:00')).toBe('Sabtu, 10 Okt');
  });

  it('periodLabel: nama pilihan, rentang, atau satu hari', () => {
    expect(periodLabel('hari-ini')).toBe('Hari Ini');
    expect(periodLabel('semua')).toBe('Semua');
    expect(periodLabel('tanggal-terpilih', { start: '2026-10-01', end: '2026-10-09' })).toBe('1 Okt – 9 Okt');
    expect(periodLabel('tanggal-terpilih', { start: '2026-10-01', end: '2026-10-01' })).toBe('1 Okt');
    expect(periodLabel('tanggal-terpilih', { start: '2026-10-03', end: '' })).toBe('3 Okt');
    expect(periodLabel('tanggal-terpilih', {})).toBe('Tanggal Terpilih');
    expect(periodLabel('tidak-dikenal')).toBe('Hari Ini');
  });

  it('groupByDay menjaga urutan masuk dan mengelompokkan per hari', () => {
    const list = [{ d: 'b', v: 1 }, { d: 'b', v: 2 }, { d: 'a', v: 3 }, { d: 'b', v: 4 }];
    const groups = groupByDay(list, (x) => x.d);
    expect(groups.map((g) => g.day)).toEqual(['b', 'a']);
    expect(groups[0].items.map((x) => x.v)).toEqual([1, 2, 4]);
  });

  it('sumByDay menjumlah per hari dan mengabaikan nilai bukan angka', () => {
    const list = [{ d: 'a', v: 10 }, { d: 'a', v: '5' }, { d: 'b', v: null }];
    const m = sumByDay(list, (x) => x.d, (x) => x.v);
    expect(m.get('a')).toBe(15);
    expect(m.get('b')).toBe(0);
  });
});
