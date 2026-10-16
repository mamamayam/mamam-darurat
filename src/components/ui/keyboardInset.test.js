import { describe, it, expect } from 'vitest';
import { keyboardInset, NO_KEYBOARD } from './Overlay';

describe('keyboardInset', () => {
  it('keyboard terbuka: selisih layout vs visual viewport', () => {
    expect(keyboardInset(890, { height: 450, offsetTop: 0, scale: 1 })).toEqual({ inset: 440, height: 450 });
  });
  it('halaman bergeser (offsetTop) ikut dihitung supaya tepi bawah pas di atas keyboard', () => {
    expect(keyboardInset(890, { height: 450, offsetTop: 40, scale: 1 })).toEqual({ inset: 400, height: 450 });
  });
  it('tanpa keyboard / bar alamat browser saja (selisih kecil): 0', () => {
    expect(keyboardInset(890, { height: 890, offsetTop: 0, scale: 1 })).toEqual(NO_KEYBOARD);
    expect(keyboardInset(890, { height: 850, offsetTop: 0, scale: 1 })).toEqual(NO_KEYBOARD);
  });
  it('layar sedang di-zoom (pinch) bukan keyboard', () => {
    expect(keyboardInset(890, { height: 400, offsetTop: 0, scale: 2 })).toEqual(NO_KEYBOARD);
  });
  it('browser tanpa visualViewport / angka rusak: 0', () => {
    expect(keyboardInset(890, undefined)).toEqual(NO_KEYBOARD);
    expect(keyboardInset(NaN, { height: 400 })).toEqual(NO_KEYBOARD);
  });
});
