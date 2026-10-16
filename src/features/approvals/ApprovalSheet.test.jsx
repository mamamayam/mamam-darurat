import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// Hook dipalsukan; yang diuji: isi sheet Persetujuan (hapus transaksi + Tambahan) dan tab awalnya.
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({ formatRupiah: (n) => `Rp ${n}`, triggerAlert: () => {}, triggerConfirm: () => {} }) }));
const state = { del: [], add: [], delError: null };
vi.mock('../../hook/useDeleteRequests', () => ({
  usePendingDeleteRequests: () => ({ list: state.del, error: state.delError, reload: async () => {} }),
  putuskanHapusTransaksi: vi.fn(),
}));
vi.mock('../../hook/usePendingAdditions', () => ({
  usePendingAdditions: () => ({ list: state.add, reload: async () => {} }),
  decideAddition: vi.fn(),
}));
vi.mock('../../components/ui', async () => {
  const real = await vi.importActual('../../components/ui');
  return { ...real, Modal: ({ isOpen, children, title }) => (isOpen ? <div data-title={title}>{children}</div> : null) };
});

import ApprovalSheet from './ApprovalSheet';

const delReq = { id: 'r1', transactionId: 't1', number: '0042', customer: 'Budi', orderType: 'Takeaway', paymentMethod: 'Tunai', total: 45000, at: '2026-10-16T03:00:00Z', items: '2x Ayam Geprek', reason: 'Salah input', requestedBy: 'Andi', status: 'menunggu', createdAt: '2026-10-16T04:00:00Z' };
const addReq = { id: 'a1', employeeId: 'e1', employeeName: 'Sari', category: 'Bonus', label: 'Target', amount: 50000, date: '2026-10-16', requestedBy: 'Andi', detail: null };

// React SSR menyisipkan <!-- --> di antara teks yang digabung; dibuang supaya pencocokan teks wajar.
const render = () => renderToString(<ApprovalSheet isOpen onClose={() => {}} />).replace(/<!-- -->/g, '').replace(/<!-- -->/g, '');

beforeEach(() => { state.del = []; state.add = []; state.delError = null; });

describe('ApprovalSheet', () => {
  it('tertutup: tidak merender apa pun', () => {
    expect(renderToString(<ApprovalSheet isOpen={false} onClose={() => {}} />)).toBe('');
  });
  it('pengajuan hapus: nomor, alasan, pengaju, dan tombol Tolak / Setujui & Hapus; jumlah di tab', () => {
    state.del = [delReq];
    const html = render();
    expect(html).toContain('#0042');
    expect(html).toContain('Salah input');
    expect(html).toContain('Diajukan Andi');
    expect(html).toContain('Setujui &amp; Hapus');
    expect(html).toContain('Hapus Transaksi (1)');
    expect(html).not.toContain('data-testid="daftar-tambahan"');
  });
  it('hanya ada Tambahan: tab Tambahan terbuka otomatis dengan kartunya', () => {
    state.add = [addReq];
    const html = render();
    expect(html).toContain('data-testid="daftar-tambahan"');
    expect(html).toContain('Sari');
    expect(html).toContain('Setelah disetujui, masuk hitungan gaji Sari');
    expect(html).toContain('Tambahan (1)');
  });
  it('keduanya ada: hapus transaksi dulu', () => {
    state.del = [delReq]; state.add = [addReq];
    expect(render()).toContain('data-testid="daftar-hapus"');
  });
  it('kosong: pesan kosong; migrasi belum jalan: petunjuk tampil', () => {
    expect(render()).toContain('Tidak ada pengajuan hapus transaksi.');
    state.delError = 'Fitur ini butuh migrasi baru';
    expect(render()).toContain('butuh migrasi baru');
  });
});
