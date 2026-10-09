import { describe, it, expect } from 'vitest';
import { storeExpenseCategories } from './expenseCategories';

describe('storeExpenseCategories', () => {
  it('menyembunyikan Kasbon (apa pun huruf besar/kecilnya) dari pilihan form Pengeluaran', () => {
    expect(storeExpenseCategories(['Belanja', 'Kasbon', 'Gaji', ' kasbon karyawan', 'Lainnya'])).toEqual(['Belanja', 'Gaji', 'Lainnya']);
  });
  it('aman untuk daftar kosong / undefined', () => {
    expect(storeExpenseCategories([])).toEqual([]);
    expect(storeExpenseCategories(undefined)).toEqual([]);
  });
});
