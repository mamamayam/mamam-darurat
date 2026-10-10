import { describe, it, expect, vi, afterEach } from 'vitest';
import { shareOrDownloadFile } from './shareFile.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const bytes = new Uint8Array([1, 2, 3]);

describe('shareOrDownloadFile', () => {
  it('perangkat bisa share berkas -> dibagikan', async () => {
    const share = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { canShare: () => true, share });
    expect(await shareOrDownloadFile(bytes, 'slip.pdf')).toBe('shared');
    expect(share.mock.calls[0][0].files[0].name).toBe('slip.pdf');
    expect(share.mock.calls[0][0].files[0].type).toBe('application/pdf');
  });

  it('pengguna menutup menu share -> cancelled, tidak mengunduh', async () => {
    const click = vi.fn();
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) });
    vi.stubGlobal('document', { createElement: () => ({ click, remove() {} }), body: { appendChild() {} } });
    expect(await shareOrDownloadFile(bytes, 'slip.pdf')).toBe('cancelled');
    expect(click).not.toHaveBeenCalled();
  });

  it('tanpa dukungan share berkas -> diunduh', async () => {
    vi.useFakeTimers();
    const a = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', { createElement: () => a, body: { appendChild: vi.fn() } });
    const create = vi.fn(() => 'blob:abc'); const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    expect(await shareOrDownloadFile(bytes, 'slip.pdf')).toBe('downloaded');
    expect(a.download).toBe('slip.pdf'); expect(a.click).toHaveBeenCalled();
    vi.advanceTimersByTime(10001);
    expect(revoke).toHaveBeenCalledWith('blob:abc');
  });
});
