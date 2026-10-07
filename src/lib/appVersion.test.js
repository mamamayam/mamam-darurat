import { describe, it, expect } from 'vitest';
import { formatBuildTime, formatVersionLabel } from './appVersion.js';

describe('formatBuildTime (WIB)', () => {
  it('UTC -> WIB (+7), tanggal ikut berganti lewat tengah malam', () => {
    expect(formatBuildTime('2026-10-07T02:30:00.000Z')).toBe('7 Okt 09.30');
    expect(formatBuildTime('2026-10-07T18:05:00.000Z')).toBe('8 Okt 01.05');
    expect(formatBuildTime('2026-12-31T17:00:00.000Z')).toBe('1 Jan 00.00');
  });
  it('tanggal tidak valid / kosong = string kosong', () => { expect(formatBuildTime('')).toBe(''); expect(formatBuildTime(undefined)).toBe(''); expect(formatBuildTime('bukan tanggal')).toBe(''); });
});

describe('formatVersionLabel', () => {
  it('versi + waktu + hash', () => { expect(formatVersionLabel('0.1.0', { at: '2026-10-07T02:30:00.000Z', sha: 'ab12cd3' })).toBe('v0.1.0 · 7 Okt 09.30 · ab12cd3'); });
  it('bagian yang tidak ada dilewati; tanpa versi = dev', () => {
    expect(formatVersionLabel('1.2.3', {})).toBe('v1.2.3');
    expect(formatVersionLabel('1.2.3', { sha: 'ab12cd3' })).toBe('v1.2.3 · ab12cd3');
    expect(formatVersionLabel('dev')).toBe('dev');
    expect(formatVersionLabel(undefined)).toBe('dev');
  });
});
