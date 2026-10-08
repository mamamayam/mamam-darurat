import { describe, it, expect } from 'vitest';
import {
  validateAdjustment, adjustmentLabel, newAdditionRow, deductionRpcArgs, summarizeTodayExpenses,
  mapAdditionRow, mapDeductionRow, mapExpenseRow, buildFeed, filterFeed, pendingRequests, formatClock, startOfLocalDayISO,
} from './quickEntryMath.js';

const form = (over = {}) => ({ employeeId: 'e1', category: 'Ongkir', label: '', amount: '15000', date: '2026-10-08', requestedBy: 'Andi', ...over });
const NOW = '2026-10-08T07:00:00.000Z';

describe('validateAdjustment', () => {
  it('mengembalikan nominal integer kalau semua benar', () => { expect(validateAdjustment(form())).toBe(15000); });
  it('menolak yang kosong / tidak valid dengan pesan jelas', () => {
    expect(() => validateAdjustment(form({ employeeId: '' }))).toThrow('Pilih karyawan.');
    expect(() => validateAdjustment(form({ category: '  ' }))).toThrow('Pilih kategori.');
    for (const bad of ['', '0', '-5', '12.5', 'abc', null]) expect(() => validateAdjustment(form({ amount: bad }))).toThrow('Nominal');
    expect(() => validateAdjustment(form({ date: '' }))).toThrow('Pilih tanggal.');
    expect(() => validateAdjustment(form({ date: '8/10/2026' }))).toThrow('Pilih tanggal.');
  });
  it('"Dicatat oleh" wajib hanya untuk staf yang mengajukan', () => {
    expect(() => validateAdjustment(form({ requestedBy: '' }), { needsRequester: true })).toThrow('Pilih siapa yang mencatat.');
    expect(validateAdjustment(form({ requestedBy: '' }))).toBe(15000);
  });
});

describe('keterangan opsional', () => {
  it('kosong -> nama kategori; terisi -> dirapikan', () => {
    expect(adjustmentLabel('', 'Ongkir')).toBe('Ongkir');
    expect(adjustmentLabel('   ', ' Ongkir ')).toBe('Ongkir');
    expect(adjustmentLabel('  antar ke kos ', 'Ongkir')).toBe('antar ke kos');
  });
});

describe('newAdditionRow — hanya Tambah yang butuh persetujuan', () => {
  it('staf: menunggu, ada nama pengaju, belum disetujui siapa pun', () => {
    const r = newAdditionRow(form(), { canApprove: false, nowISO: NOW });
    expect(r).toMatchObject({ status: 'menunggu', source: 'staff', requested_by: 'Andi', approved_by: null, approved_at: null, label: 'Ongkir', amount: 15000, category: 'Ongkir' });
  });
  it('owner: langsung disetujui, tanpa pengaju', () => {
    const r = newAdditionRow(form({ requestedBy: '' }), { canApprove: true, nowISO: NOW });
    expect(r).toMatchObject({ status: 'disetujui', source: 'owner', requested_by: null, approved_by: 'Owner', approved_at: NOW });
  });
  it('staf tanpa "Dicatat oleh" ditolak', () => {
    expect(() => newAdditionRow(form({ requestedBy: ' ' }), { canApprove: false, nowISO: NOW })).toThrow('Pilih siapa yang mencatat.');
  });
});

describe('deductionRpcArgs — potongan langsung dicatat (tanpa persetujuan)', () => {
  it('tunai (bawaan) dan non-tunai dipetakan; nilai asing jatuh ke Tunai', () => {
    expect(deductionRpcArgs(form({ category: 'Kasbon', paymentMethod: 'Tunai' }))).toEqual({
      p_employee_id: 'e1', p_label: 'Kasbon', p_amount: 15000, p_date: '2026-10-08', p_category: 'Kasbon', p_payment_method: 'Tunai',
    });
    expect(deductionRpcArgs(form({ paymentMethod: 'Non-Tunai' })).p_payment_method).toBe('Non-Tunai');
    expect(deductionRpcArgs(form({ paymentMethod: 'transfer' })).p_payment_method).toBe('Tunai');
    expect(deductionRpcArgs(form()).p_payment_method).toBe('Tunai');
  });
  it('tidak butuh "Dicatat oleh" tapi tetap divalidasi', () => {
    expect(deductionRpcArgs(form({ requestedBy: '' })).p_amount).toBe(15000);
    expect(() => deductionRpcArgs(form({ amount: '0' }))).toThrow('Nominal');
  });
});

describe('summarizeTodayExpenses', () => {
  it('memisahkan karyawan vs toko dan hanya menghitung hari ini', () => {
    const exps = [
      { amount: 185000, date: '2026-10-08', employeeId: null },
      { amount: 200000, date: '2026-10-08', employeeId: 'e1' },
      { amount: 50000, date: '2026-10-08T00:00:00', employeeId: 'e2' },
      { amount: 999, date: '2026-10-07', employeeId: null },
      { amount: 'x', date: '2026-10-08', employeeId: null },
    ];
    expect(summarizeTodayExpenses(exps, '2026-10-08')).toEqual({ karyawan: 250000, toko: 185000 });
    expect(summarizeTodayExpenses(undefined, '2026-10-08')).toEqual({ karyawan: 0, toko: 0 });
  });
});

describe('buildFeed / filterFeed', () => {
  const names = { e1: 'Budi', e2: 'Sari' };
  const additions = [
    mapAdditionRow({ id: 'a1', employee_id: 'e2', category: 'Ongkir', label: 'Antar', amount: 15000, date: '2026-10-08', status: 'menunggu', requested_by: 'Sari', created_at: '2026-10-08T04:40:00.000Z' }, names),
    mapAdditionRow({ id: 'a2', employee_id: 'e1', category: 'Bonus', label: 'Target', amount: 100000, date: '2026-10-08', status: 'ditolak', reject_reason: 'Belum tercapai', created_at: '2026-10-08T01:50:00.000Z' }, names),
  ];
  const deductions = [mapDeductionRow({ id: 'd1', employee_id: 'e1', category: 'Kasbon', label: 'Kontrakan', amount: 200000, date: '2026-10-08', expense_id: 'x1', created_at: '2026-10-08T03:12:00.000Z' }, names)];
  const expenses = [
    mapExpenseRow({ id: 'x1', category: 'Kasbon', store_or_supplier_name: 'Budi', detail: 'Kontrakan', amount: 200000, transaction_date: '2026-10-08', payment_method: 'Tunai', employee_id: 'e1', created_at: '2026-10-08T03:12:00.000Z' }),
    mapExpenseRow({ id: 'x2', category: 'Belanja', store_or_supplier_name: 'Pasar Induk', detail: 'Bumbu\nMinyak', amount: 185000, transaction_date: '2026-10-08', payment_method: 'Tunai', created_at: '2026-10-08T00:30:00.000Z' }),
  ];
  const feed = buildFeed({ additions, deductions, expenses });

  it('pengeluaran yang terhubung ke karyawan tidak muncul dobel dengan potongannya', () => {
    expect(feed.map((i) => i.key)).toEqual(['tambah-a1', 'potongan-d1', 'tambah-a2', 'pengeluaran-x2']);
  });
  it('urut terbaru dulu, berisi status & alasan', () => {
    expect(feed[0]).toMatchObject({ kind: 'tambah', title: 'Sari', tag: 'Ongkir', status: 'menunggu', by: 'Sari' });
    expect(feed[2]).toMatchObject({ status: 'ditolak', reason: 'Belum tercapai' });
    expect(feed[1]).toMatchObject({ kind: 'potongan', status: 'tercatat', title: 'Budi' });
  });
  it('pengeluaran toko: judul = kategori, tag = toko, catatan = baris pertama', () => {
    expect(feed[3]).toMatchObject({ kind: 'pengeluaran', title: 'Belanja', tag: 'Pasar Induk', note: 'Bumbu', amount: 185000 });
  });
  it('tab karyawan / toko / semua', () => {
    expect(filterFeed(feed, 'karyawan').map((i) => i.kind)).toEqual(['tambah', 'potongan', 'tambah']);
    expect(filterFeed(feed, 'toko').map((i) => i.kind)).toEqual(['pengeluaran']);
    expect(filterFeed(feed, 'semua')).toHaveLength(4);
  });
});

describe('pendingRequests / pemetaan / waktu', () => {
  it('pengajuan menunggu, paling lama di atas', () => {
    const list = [
      { id: 1, status: 'menunggu', createdAt: '2026-10-08T05:00:00Z' },
      { id: 2, status: 'disetujui', createdAt: '2026-10-08T01:00:00Z' },
      { id: 3, status: 'menunggu', createdAt: '2026-10-08T02:00:00Z' },
    ];
    expect(pendingRequests(list).map((a) => a.id)).toEqual([3, 1]);
  });
  it('baris tanpa kolom status (sebelum migrasi) dianggap disetujui', () => {
    expect(mapAdditionRow({ id: 'a', employee_id: 'e', category: 'Bonus', label: 'x', amount: 1, date: '2026-10-08' }).status).toBe('disetujui');
  });
  it('karyawan tak dikenal diberi nama cadangan', () => {
    expect(mapAdditionRow({ id: 'a', employee_id: 'zzz', category: 'B', label: 'x', amount: 1, date: '2026-10-08' }, {}).employeeName).toBe('Karyawan');
  });
  it('formatClock & startOfLocalDayISO', () => {
    expect(formatClock('')).toBe('');
    expect(formatClock('bukan tanggal')).toBe('');
    expect(formatClock(new Date(2026, 9, 8, 7, 5).toISOString())).toBe('07:05');
    expect(new Date(startOfLocalDayISO('2026-10-08')).getHours()).toBe(0);
    expect(new Date(startOfLocalDayISO('2026-10-08')).getDate()).toBe(8);
  });
});
