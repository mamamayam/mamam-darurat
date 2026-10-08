import { describe, it, expect } from 'vitest';
import { initialConn, nextConn, connStatus, FAIL_THRESHOLD, CONN_MESSAGES, isChunkLoadError, shouldAutoReload, AUTO_RELOAD_WINDOW_MS } from './connectionLogic.js';

const run = (st, ...events) => events.reduce(nextConn, st);

describe('status koneksi', () => {
  it('awal: online, status ok', () => { expect(connStatus(initialConn())).toBe('ok'); expect(connStatus(initialConn(false))).toBe('offline'); });
  it('event offline browser -> offline; online lagi -> ok', () => {
    const off = run(initialConn(), 'offline');
    expect(connStatus(off)).toBe('offline');
    expect(connStatus(run(off, 'online'))).toBe('ok');
  });
  it('permintaan yang gagal tersambung -> server tidak terjangkau (internet ada, server tidak tembus)', () => {
    expect(FAIL_THRESHOLD).toBe(1);
    expect(connStatus(run(initialConn(), 'fail'))).toBe('server');
    expect(connStatus(run(initialConn(), 'fail', 'fail'))).toBe('server');
  });
  it('satu permintaan berhasil memulihkan dan mereset hitungan gagal', () => {
    const down = run(initialConn(), 'fail', 'fail', 'fail');
    expect(connStatus(down)).toBe('server');
    expect(connStatus(run(down, 'ok'))).toBe('ok');
    expect(run(run(initialConn(), 'fail'), 'ok').failures).toBe(0);   // gagal tidak menumpuk melewati keberhasilan
  });
  it('permintaan berhasil saat browser mengira offline (sinyal basi) -> ok', () => {
    expect(connStatus(run(initialConn(false), 'ok'))).toBe('ok');
  });
  it('offline lebih utama daripada server (tidak ada internet sama sekali)', () => {
    expect(connStatus(run(initialConn(), 'fail', 'fail', 'offline'))).toBe('offline');
  });
  it('kembali online membersihkan hitungan gagal lama', () => {
    expect(connStatus(run(initialConn(), 'fail', 'fail', 'offline', 'online'))).toBe('ok');
  });
  it('tidak membuat objek baru kalau tidak ada perubahan (hemat render)', () => {
    const st = initialConn();
    expect(nextConn(st, 'ok')).toBe(st); expect(nextConn(st, 'online')).toBe(st); expect(nextConn(st, 'apa-ini')).toBe(st);
    const off = nextConn(st, 'offline'); expect(nextConn(off, 'offline')).toBe(off);
  });
  it('hitungan gagal dibatasi (tidak membengkak tanpa batas)', () => {
    let st = initialConn(); for (let i = 0; i < 500; i++) st = nextConn(st, 'fail');
    expect(st.failures).toBeLessThanOrEqual(99);
  });
  it('pesan tersedia untuk tiap keadaan', () => {
    for (const k of ['offline', 'server', 'back']) expect(CONN_MESSAGES[k].length).toBeGreaterThan(10);
  });
});

describe('galat memuat halaman (lazy import)', () => {
  it('dikenali dari pesan berbagai browser', () => {
    for (const m of [
      'Failed to fetch dynamically imported module: https://x/assets/Foo-abc.js',        // Chrome
      'error loading dynamically imported module: https://x/assets/Foo.js',               // Firefox
      'Importing a module script failed.',                                                // Safari
      'Loading chunk 12 failed.', 'Loading CSS chunk 3 failed.',
    ]) expect(isChunkLoadError(new Error(m))).toBe(true);
  });
  it('galat biasa bukan galat memuat halaman', () => {
    for (const e of [new Error('Cannot read properties of undefined'), new TypeError('x is not a function'), null, undefined, '']) expect(isChunkLoadError(e)).toBe(false);
  });
});

describe('muat ulang otomatis saat halaman lama hilang setelah deploy', () => {
  const now = 1_000_000_000_000;
  it('belum pernah memuat ulang -> boleh', () => { expect(shouldAutoReload(0, now)).toBe(true); expect(shouldAutoReload(null, now)).toBe(true); expect(shouldAutoReload(NaN, now)).toBe(true); });
  it('baru saja memuat ulang -> jangan ulang (cegah putaran tanpa akhir)', () => {
    expect(shouldAutoReload(now - 1000, now)).toBe(false);
    expect(shouldAutoReload(now - AUTO_RELOAD_WINDOW_MS + 1, now)).toBe(false);
  });
  it('sudah lewat jendela waktu -> boleh lagi', () => { expect(shouldAutoReload(now - AUTO_RELOAD_WINDOW_MS, now)).toBe(true); expect(shouldAutoReload(now - 10 * 60 * 1000, now)).toBe(true); });
  it('jam perangkat melompat (catatan dari masa depan dekat) -> jangan ulang', () => { expect(shouldAutoReload(now + 5000, now)).toBe(false); });
});
