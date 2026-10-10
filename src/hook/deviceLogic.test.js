import { describe, it, expect } from 'vitest';
import {
  STATUS, deviceLock, isMissingTable, validateDeviceName, sortDevices, lastSeenLabel, needsSeenUpdate, deviceOptionsFromRows,
} from './deviceLogic';

describe('deviceLogic', () => {
  it('deviceLock: hanya staf yang dikunci; owner dan fitur-mati tidak', () => {
    expect(deviceLock('staff', STATUS.OK)).toBeNull();
    expect(deviceLock('staff', STATUS.OFF)).toBeNull();
    expect(deviceLock('staff', STATUS.PENDING)).toBe('menunggu');
    expect(deviceLock('staff', STATUS.REVOKED)).toBe('dicabut');
    expect(deviceLock('staff', STATUS.FAILED)).toBe('gagal');
    expect(deviceLock('staff', STATUS.LOADING)).toBe('memuat');
    for (const s of Object.values(STATUS)) expect(deviceLock('owner', s)).toBeNull();
    expect(deviceLock(null, STATUS.PENDING)).toBeNull();
  });

  it('isMissingTable: kode dan pesan PostgREST/Postgres', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ message: 'Could not find the table public.devices in the schema cache' })).toBe(true);
    expect(isMissingTable({ message: 'Failed to fetch' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });

  it('validateDeviceName: wajib, maksimal 40, tidak kembar dengan HP terdaftar lain', () => {
    const list = [{ id: 'a', status: 'terdaftar', name: 'HP Budi' }, { id: 'b', status: 'dicabut', name: 'HP Lama' }];
    expect(validateDeviceName('   ', list).ok).toBe(false);
    expect(validateDeviceName('x'.repeat(41), list).ok).toBe(false);
    expect(validateDeviceName('hp  budi', list, 'z').ok).toBe(false);
    expect(validateDeviceName('HP Budi', list, 'a')).toEqual({ ok: true, name: 'HP Budi' });   // HP itu sendiri boleh
    expect(validateDeviceName('HP Lama', list, 'z').ok).toBe(true);                            // yang dicabut tidak memblokir nama
    expect(validateDeviceName('  HP   Siti ', list, 'z')).toEqual({ ok: true, name: 'HP Siti' });
  });

  it('sortDevices: menunggu, lalu terdaftar (terbaru aktif di atas), lalu dicabut', () => {
    const out = sortDevices([
      { id: '1', status: 'dicabut', last_seen_at: '2026-10-10T10:00:00Z' },
      { id: '2', status: 'terdaftar', last_seen_at: '2026-10-10T08:00:00Z' },
      { id: '3', status: 'menunggu', created_at: '2026-10-09T08:00:00Z' },
      { id: '4', status: 'terdaftar', last_seen_at: '2026-10-10T09:00:00Z' },
    ]);
    expect(out.map((d) => d.id)).toEqual(['3', '4', '2', '1']);
  });

  it('lastSeenLabel dan needsSeenUpdate', () => {
    const now = new Date('2026-10-10T12:00:00Z').getTime();
    expect(lastSeenLabel(null, now)).toBe('Belum pernah aktif');
    expect(lastSeenLabel('2026-10-10T11:59:40Z', now)).toBe('Aktif baru saja');
    expect(lastSeenLabel('2026-10-10T11:58:00Z', now)).toBe('Aktif 2 menit lalu');
    expect(lastSeenLabel('2026-10-10T10:00:00Z', now)).toBe('Aktif 2 jam lalu');
    expect(lastSeenLabel('2026-10-08T12:00:00Z', now)).toBe('Aktif 2 hari lalu');
    expect(needsSeenUpdate(null, now)).toBe(true);
    expect(needsSeenUpdate('2026-10-10T11:58:00Z', now)).toBe(false);
    expect(needsSeenUpdate('2026-10-10T11:50:00Z', now)).toBe(true);
  });

  it('deviceOptionsFromRows: satu pilihan per perangkat, nama terbaru, "Tanpa perangkat" bila ada data lama', () => {
    expect(deviceOptionsFromRows([])).toEqual([]);
    const rows = [
      { device_id: 'b', device_name: 'HP Budi' },
      { device_id: 'a', device_name: 'HP Kasir Depan' },
      { device_id: 'b', device_name: 'HP Budi (lama)' },
      { device_id: 'c', device_name: null },
      { device_id: null, device_name: null },
    ];
    expect(deviceOptionsFromRows(rows)).toEqual([
      { key: 'b', label: 'HP Budi' },
      { key: 'a', label: 'HP Kasir Depan' },
      { key: 'c', label: 'Perangkat tanpa nama' },
      { key: 'tanpa', label: 'Tanpa perangkat' },
    ]);
  });
});
