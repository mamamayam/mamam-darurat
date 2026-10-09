import { describe, it, expect } from 'vitest';
import { formatJam, formatTanggal, msKeDetikBerikutnya } from './clockFormat';

describe('formatJam', () => {
    it('menampilkan HH:mm:ss dengan nol di depan', () => {
        expect(formatJam(new Date(2026, 9, 9, 7, 5, 3))).toBe('07:05:03');
    });

    it('tengah malam tampil 00:00:00, bukan 24:00:00', () => {
        expect(formatJam(new Date(2026, 9, 9, 0, 0, 0))).toBe('00:00:00');
    });

    it('format 24 jam', () => {
        expect(formatJam(new Date(2026, 9, 9, 14, 38, 59))).toBe('14:38:59');
    });
});

describe('formatTanggal', () => {
    it('memuat hari, tanggal, dan bulan singkat bahasa Indonesia', () => {
        const teks = formatTanggal(new Date(2026, 9, 9, 14, 38, 5));
        expect(teks).toMatch(/9/);
        expect(teks).toMatch(/Okt/);
    });
});

describe('msKeDetikBerikutnya', () => {
    it('tepat di awal detik menunggu 1000 ms', () => {
        expect(msKeDetikBerikutnya(new Date(2026, 9, 9, 14, 38, 5, 0))).toBe(1000);
    });

    it('di tengah detik menunggu sisanya', () => {
        expect(msKeDetikBerikutnya(new Date(2026, 9, 9, 14, 38, 5, 250))).toBe(750);
    });

    it('di ujung detik menunggu 1 ms', () => {
        expect(msKeDetikBerikutnya(new Date(2026, 9, 9, 14, 38, 5, 999))).toBe(1);
    });
});
