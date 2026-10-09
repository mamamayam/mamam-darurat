import { describe, it, expect } from 'vitest';
import { orderMenus, moveId, itemAtPoint, readMenuOrder, saveMenuOrder, clearMenuOrder } from './menuOrder';

const items = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id.toUpperCase() }));
const ids = (list) => list.map((i) => i.id);
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

describe('orderMenus', () => {
  it('tanpa urutan tersimpan = urutan bawaan', () => {
    expect(ids(orderMenus(items, null))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(orderMenus(items, []))).toEqual(['a', 'b', 'c', 'd']);
  });
  it('mengikuti urutan tersimpan', () => {
    expect(ids(orderMenus(items, ['d', 'b', 'a', 'c']))).toEqual(['d', 'b', 'a', 'c']);
  });
  it('menu baru (belum tersimpan) ditaruh di belakang; id yang sudah tidak ada diabaikan; id ganda dibuang', () => {
    expect(ids(orderMenus(items, ['c', 'x', 'a', 'c']))).toEqual(['c', 'a', 'b', 'd']);
  });
  it('menu yang disembunyikan izin (tidak ada di items) tidak muncul walau ada di daftar tersimpan', () => {
    expect(ids(orderMenus(items.slice(0, 2), ['d', 'b', 'a']))).toEqual(['b', 'a']);
  });
});

describe('moveId', () => {
  it('pindah ke depan dan ke belakang, sisanya bergeser', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });
  it('id sama / tak dikenal = tidak berubah', () => {
    const base = ['a', 'b', 'c'];
    expect(moveId(base, 'a', 'a')).toBe(base);
    expect(moveId(base, 'z', 'a')).toBe(base);
    expect(moveId(base, 'a', 'z')).toBe(base);
  });
  it('tidak mengubah array asli', () => {
    const base = ['a', 'b', 'c'];
    moveId(base, 'c', 'a');
    expect(base).toEqual(['a', 'b', 'c']);
  });
});

describe('itemAtPoint', () => {
  const rects = { a: { left: 0, right: 100, top: 0, bottom: 100 }, b: { left: 110, right: 210, top: 0, bottom: 100 } };
  it('mengenali elemen di bawah titik, null kalau di celah / di luar', () => {
    expect(itemAtPoint(rects, 50, 50)).toBe('a');
    expect(itemAtPoint(rects, 150, 20)).toBe('b');
    expect(itemAtPoint(rects, 105, 50)).toBeNull();
    expect(itemAtPoint(rects, 500, 500)).toBeNull();
  });
});

describe('simpan / baca per peran', () => {
  it('terpisah per peran, bisa dihapus, dan tahan data rusak', () => {
    const s = fakeStorage();
    expect(readMenuOrder('owner', s)).toBeNull();
    saveMenuOrder('owner', ['b', 'a'], s);
    saveMenuOrder('staff', ['c'], s);
    expect(readMenuOrder('owner', s)).toEqual(['b', 'a']);
    expect(readMenuOrder('staff', s)).toEqual(['c']);
    clearMenuOrder('owner', s);
    expect(readMenuOrder('owner', s)).toBeNull();
    s.setItem('mamam-pos-menu-order:staff', '{rusak');
    expect(readMenuOrder('staff', s)).toBeNull();
  });
});
