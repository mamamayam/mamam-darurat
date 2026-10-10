import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import DeviceLockScreen from './DeviceLockScreen.jsx';
import FilterBar from '../components/ui/FilterBar.jsx';

const noop = () => {};

describe('DeviceLockScreen', () => {
  it('HP menunggu: judul + kode perangkat + Cek lagi + Keluar', () => {
    const html = renderToString(<DeviceLockScreen status="menunggu" code="7F3A-92B1" onRetry={noop} onLogout={noop} />);
    expect(html).toContain('Perangkat belum terdaftar');
    expect(html).toContain('7F3A-92B1');
    expect(html).toContain('Cek lagi');
    expect(html).toContain('Keluar');
  });

  it('HP dicabut: pesan beda, kode tetap tampil', () => {
    const html = renderToString(<DeviceLockScreen status="dicabut" code="7F3A-92B1" onRetry={noop} onLogout={noop} />);
    expect(html).toContain('Akses perangkat dicabut');
    expect(html).toContain('7F3A-92B1');
  });

  it('gagal cek (offline): tanpa kode, minta cek internet', () => {
    const html = renderToString(<DeviceLockScreen status="gagal" code="7F3A-92B1" onRetry={noop} onLogout={noop} />);
    expect(html).toContain('Cek internet');
    expect(html).not.toContain('7F3A-92B1');
  });
});

describe('FilterBar tombol perangkat', () => {
  const base = {
    query: '', onQueryChange: noop, period: { mode: 'hari-ini', start: '', end: '' }, onPeriodChange: noop,
    typeValue: 'semua', onTypeChange: noop, typeOptions: [], typeAllLabel: 'Semua', typeChipLabel: 'Semua Tipe', typeTitle: 'Tipe',
    sortValue: 'terbaru', sortDefault: 'terbaru', onSortChange: noop, sortOptions: [{ key: 'terbaru', label: 'Terbaru', short: 'Terbaru' }],
  };

  it('tidak dirender kalau deviceOptions tidak diberikan (tampilan lama tidak berubah)', () => {
    expect(renderToString(<FilterBar {...base} />)).not.toContain('filter-device');
  });

  it('dirender di samping pencarian kalau deviceOptions diberikan; menyala saat filter aktif', () => {
    const off = renderToString(<FilterBar {...base} deviceOptions={[{ key: 'a', label: 'HP A' }]} deviceValue="semua" onDeviceChange={noop} />);
    expect(off).toContain('filter-device');
    const on = renderToString(<FilterBar {...base} deviceOptions={[{ key: 'a', label: 'HP A' }]} deviceValue="a" onDeviceChange={noop} />);
    expect(on).toContain('border-accent-500');
    expect(off.match(/grid-cols-3/g)).toHaveLength(1);   // tiga chip tetap satu baris
  });
});
