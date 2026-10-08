import { describe, it, expect, vi, afterEach } from 'vitest';
import { trackedFetch, networkMessage, currentConnectionStatus } from './connection.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('trackedFetch', () => {
  it('balasan sukses diteruskan apa adanya dan status ok', async () => {
    const res = new Response('{"a":1}', { status: 200 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    expect(await trackedFetch('https://x')).toBe(res);
    expect(currentConnectionStatus()).toBe('ok');
  });
  it('balasan error HTTP (mis. 400/500) juga diteruskan apa adanya — server terjangkau', async () => {
    const res = new Response('{"message":"x"}', { status: 500 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    expect(await trackedFetch('https://x')).toBe(res);
    expect(currentConnectionStatus()).toBe('ok');
  });
  it('gagal tersambung: TIDAK melempar "Failed to fetch"; dijawab 599 dengan pesan ramah, status jadi server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const res = await trackedFetch('https://x');
    expect(res.status).toBe(599);
    const body = await res.json();
    expect(body.message).toBe('Tidak bisa terhubung ke server. Cek internet lalu coba lagi.');
    expect(body.message).not.toMatch(/failed to fetch|TypeError/i);
    expect(body.msg).toBe(body.message);
    expect(currentConnectionStatus()).toBe('server');
  });
  it('permintaan berhasil berikutnya memulihkan status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await trackedFetch('https://x');
    expect(currentConnectionStatus()).toBe('server');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
    await trackedFetch('https://x');
    expect(currentConnectionStatus()).toBe('ok');
  });
  it('dibatalkan sengaja (AbortError) tetap dilempar dan tidak dihitung putus', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(trackedFetch('https://x')).rejects.toBe(abort);
    expect(currentConnectionStatus()).toBe('ok');
  });
  it('pesan menyesuaikan: browser offline -> "Tidak ada koneksi internet."', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(networkMessage()).toBe('Tidak ada koneksi internet.');
    vi.stubGlobal('navigator', { onLine: true });
    expect(networkMessage()).toMatch(/terhubung ke server/);
  });
});
