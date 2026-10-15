import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import PeriodFilter from './PeriodFilter.jsx';

const noop = () => {};
const base = { mode: 'bulan', month: '2026-09', day: '2026-10-15', start: '', end: '' };
const html = (value, today = '2026-10-15') => renderToString(<PeriodFilter value={value} onChange={noop} today={today} />);

describe('PeriodFilter', () => {
  it('Bulanan: label bulan + tombol Ke bulan ini; > aktif di bulan lalu', () => {
    const h = html(base);
    expect(h).toContain('September 2026');
    expect(h).toContain('Ke bulan ini');
    expect(h).toContain('Bulanan'); expect(h).toContain('Rentang');
    expect(h).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Berikutnya"/);
  });
  it('Bulanan di bulan berjalan: > dan Ke bulan ini mati', () => {
    const h = html({ ...base, month: '2026-10' });
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Berikutnya"/);
    expect(h).toMatch(/disabled=""[^>]*data-testid="period-today"|data-testid="period-today"[^>]*disabled=""/);
  });
  it('Harian: label hari + Ke hari ini', () => {
    const h = html({ ...base, mode: 'hari', day: '2026-10-14' });
    expect(h).toContain('Rab, 14 Okt 2026');
    expect(h).toContain('Ke hari ini');
  });
  it('Semua: tanpa navigasi', () => {
    const h = html({ ...base, mode: 'semua' });
    expect(h).toContain('Menampilkan semua data');
    expect(h).not.toContain('period-label');
  });
  it('Rentang: dua input tanggal + tombol cepat', () => {
    const h = html({ ...base, mode: 'rentang' });
    expect(h.match(/type="date"/g)).toHaveLength(2);
    expect(h).toContain('7 hari terakhir'); expect(h).toContain('30 hari terakhir'); expect(h).toContain('3 bulan terakhir');
  });
});
