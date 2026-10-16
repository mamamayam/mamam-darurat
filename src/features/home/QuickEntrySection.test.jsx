import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// Hook dipalsukan; yang diuji: baris "Catatan Hari Ini" hanya bisa diketuk (diubah) oleh yang berizin `catatan.ubah`.
const auth = { owner: true };
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ can: (p) => (auth.owner ? true : p === 'karyawan.upah') }) }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({ formatRupiah: (n) => `Rp ${n}`, triggerAlert: () => {}, triggerConfirm: () => {} }) }));
vi.mock('../../hook/useExpenseData', () => ({ useExpenseData: () => ({}) }));
vi.mock('../expense/ExpenseFormSheet', () => ({ default: () => null }));
vi.mock('./QuickAdjustmentSheet', () => ({ default: () => null }));

const quick = {
  employees: [], pending: [], totals: { karyawan: 0, toko: 0 }, today: '2026-10-16', loading: false, error: null, reload: () => {},
  lastRequester: { current: '' }, feed: [],
};
vi.mock('../../hook/useQuickEntries', () => ({ useQuickEntries: () => quick }));

import QuickEntrySection from './QuickEntrySection';

const base = { status: 'tercatat', time: '10:27', amount: 1000, tag: '', note: '' };
beforeEach(() => {
  auth.owner = true;
  quick.feed = [
    { ...base, key: 'p1', kind: 'pengeluaran', title: 'Belanja', source: { id: 'x1' } },
    { ...base, key: 'd1', kind: 'potongan', title: 'Budi', tag: 'Kasbon', source: { id: 'd1' } },
    { ...base, key: 'a1', kind: 'tambah', title: 'Sari', tag: 'Ongkir', status: 'disetujui', source: { id: 'a1' } },
  ];
});

describe('Catatan Hari Ini — ubah dari Beranda', () => {
  it('owner: tiap baris (Pengeluaran, Potongan, Tambah) bisa diketuk untuk diubah', () => {
    const html = renderToString(<QuickEntrySection />);
    expect((html.match(/role="button"/g) || []).length).toBe(3);
    expect(html).toContain('Ubah catatan Belanja');
    expect(html).toContain('Ubah catatan Budi');
    expect(html).toContain('Ubah catatan Sari');
  });
  it('staf: baris hanya tampilan, tidak bisa diketuk', () => {
    auth.owner = false;
    const html = renderToString(<QuickEntrySection />);
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('Ubah catatan');
  });
});
