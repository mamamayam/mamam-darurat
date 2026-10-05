import { describe, it, expect } from 'vitest';
import { createBackStack } from './backStack.js';

/**
 * Browser palsu yang meniru aturan riwayat sungguhan:
 *  - pushState membuang entri "maju" lalu menambah entri baru
 *  - go(n) ASINKRON; arah dihitung saat dijalankan; popstate dikirim sesudahnya
 *  - menuju entri "luar" (halaman sebelumnya) = keluar dari aplikasi, tanpa popstate
 */
function fakeBrowser({ previousPage = true, staleEntries = [], navType } = {}) {
  const entries = [];
  if (previousPage) entries.push({ external: true, state: null });
  for (const st of staleEntries) entries.push({ state: st });
  entries.push({ state: null });                // entri aplikasi saat dimuat
  let index = entries.length - 1;
  let left = false;
  const listeners = [];
  const log = [];
  const fire = () => { log.push('pop'); listeners.forEach((fn) => fn({ state: entries[index].state })); };
  const win = {
    history: {
      get state() { return entries[index].state; },
      pushState(state) { entries.splice(index + 1); entries.push({ state }); index = entries.length - 1; log.push('push'); },
      replaceState(state) { entries[index].state = state; log.push('replace'); },
      go(n) {
        log.push(`go${n}`);
        setTimeout(() => {
          const next = index + n;
          if (next < 0 || next >= entries.length) return;
          index = next;
          if (entries[index].external) { left = true; return; }
          fire();
        }, 0);
      },
      back() { win.history.go(-1); },
    },
    addEventListener(type, fn) { if (type === 'popstate') listeners.push(fn); },
    ...(navType ? { performance: { getEntriesByType: () => [{ type: navType }] } } : {}),
  };
  return {
    win, log,
    get index() { return index; },
    get left() { return left; },
    get length() { return entries.length; },
    get listeners() { return listeners.length; },
    get state() { return entries[index].state; },
    userBack: () => win.history.go(-1),         // tombol Back / geser mundur
    userForward: () => win.history.go(1),
  };
}

const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

describe('backStack — dasar', () => {
  it('tanpa lapisan: tidak menyentuh riwayat sama sekali; Back = keluar dari aplikasi', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win);
    await tick();
    expect(b.log).toEqual([]);                                   // belum ada replace/push
    expect(bs.snapshot()).toMatchObject({ layers: 0, depth: 0 });
    b.userBack(); await tick();
    expect(b.left).toBe(true);
  });

  it('satu lapisan: dibuat 1 entri; Back menutup lapisan (close sekali) dan TIDAK keluar', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win);
    let closed = 0; bs.register(() => { closed += 1; }); await tick();
    expect(b.log).toEqual(['replace', 'push']);   // belum ada pop: tidak ada traversal
    expect(bs.snapshot()).toMatchObject({ layers: 1, depth: 1 });
    b.userBack(); await tick();
    expect(closed).toBe(1);
    expect(b.left).toBe(false);
    expect(bs.snapshot()).toMatchObject({ layers: 0, depth: 0 });
    b.userBack(); await tick();                                  // Back berikutnya: keluar
    expect(b.left).toBe(true);
    expect(closed).toBe(1);
  });

  it('dua lapisan: yang terakhir dibuka ditutup duluan (LIFO)', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win); const order = [];
    bs.register(() => order.push('A')); bs.register(() => order.push('B')); await tick();
    expect(bs.snapshot()).toMatchObject({ layers: 2, depth: 2 });
    b.userBack(); await tick(); expect(order).toEqual(['B']);
    b.userBack(); await tick(); expect(order).toEqual(['B', 'A']);
    expect(b.left).toBe(false);
    b.userBack(); await tick(); expect(b.left).toBe(true);
  });
});

describe('backStack — lapisan ditutup lewat tombol di layar', () => {
  it('unregister: entri riwayat ikut dibuang (go -1), close TIDAK dipanggil, Back berikutnya langsung keluar', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win);
    let closed = 0; const id = bs.register(() => { closed += 1; }); await tick();
    bs.unregister(id); await tick();
    expect(b.log).toContain('go-1');
    expect(closed).toBe(0);
    expect(bs.snapshot()).toMatchObject({ layers: 0, depth: 0, traversing: false });
    b.userBack(); await tick();
    expect(b.left).toBe(true);                                   // tidak ada "Back yang tidak terjadi apa-apa"
  });

  it('tutup lapisan lalu buka lapisan lain dalam satu tarikan napas: tidak ada go()/push sia-sia', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win);
    const a = bs.register(() => {}); await tick();
    const before = b.log.length;
    bs.unregister(a); bs.register(() => {}); await tick();
    expect(b.log.length).toBe(before);                           // tidak ada operasi riwayat baru
    expect(bs.snapshot()).toMatchObject({ layers: 1, depth: 1 });
  });

  it('menutup lapisan yang BUKAN teratas: jumlah entri tetap cocok, Back menutup yang tersisa', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win); const order = [];
    const a = bs.register(() => order.push('A')); bs.register(() => order.push('B')); await tick();
    bs.unregister(a); await tick();
    expect(bs.snapshot()).toMatchObject({ layers: 1, depth: 1 });
    b.userBack(); await tick();
    expect(order).toEqual(['B']);
    expect(b.left).toBe(false);
  });

  it('close() yang memanggil unregister sendiri (seperti modal sungguhan) tidak menggandakan go()', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win);
    let id; id = bs.register(() => { bs.unregister(id); }); await tick();
    const gosBefore = b.log.filter((l) => l.startsWith('go')).length;
    b.userBack(); await tick();
    expect(b.log.filter((l) => l.startsWith('go')).length).toBe(gosBefore + 1);   // hanya go dari pengguna
    expect(bs.snapshot()).toMatchObject({ layers: 0, depth: 0 });
    expect(b.left).toBe(false);
  });
});

describe('backStack — urutan operasi asinkron', () => {
  it('lapisan baru yang datang saat go() masih berjalan ditunda, lalu didorong sesudah popstate', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win); const order = [];
    const a = bs.register(() => {}); await tick();
    bs.unregister(a);
    await Promise.resolve(); await Promise.resolve();            // sync() jalan: go(-1) dikirim, menunggu popstate
    expect(bs.snapshot().traversing).toBe(true);
    // Dua lapisan baru datang di tengah go(): jumlah lapisan (2) > entri yang ada (1),
    // jadi tanpa serialisasi sync() akan langsung pushState menabrak go() yang belum selesai.
    bs.register(() => order.push('B')); bs.register(() => order.push('C'));
    await tick();
    // Urutan operasi riwayat harus: ... go-1, pop, push, push  (push TIDAK boleh menyelip sebelum pop dari go)
    const iGo = b.log.lastIndexOf('go-1');
    const iPopAfterGo = b.log.indexOf('pop', iGo);
    const iPushAfterGo = b.log.indexOf('push', iGo);
    expect(iPopAfterGo).toBeGreaterThan(iGo);
    expect(iPushAfterGo).toBeGreaterThan(iPopAfterGo);           // push SESUDAH go selesai, bukan menabraknya
    expect(bs.snapshot()).toMatchObject({ layers: 2, depth: 2, traversing: false });
    b.userBack(); await tick(); b.userBack(); await tick();
    expect(order).toEqual(['C', 'B']);                           // tetap rapi: C lalu B, tidak keluar
    expect(b.left).toBe(false);
    b.userBack(); await tick();
    expect(b.left).toBe(true);
  });

  it('pengguna menekan Forward setelah Back: tidak membuka ulang apa pun, dikembalikan ke posisi semula', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win);
    let closed = 0; bs.register(() => { closed += 1; }); await tick();
    b.userBack(); await tick();
    expect(closed).toBe(1);
    const idxBase = b.index;
    b.userForward(); await tick(40);
    expect(closed).toBe(1);
    expect(bs.snapshot()).toMatchObject({ layers: 0, depth: 0, traversing: false });
    expect(b.index).toBe(idxBase);                               // kembali di entri dasar
  });
});

describe('backStack — refresh dan entri basi', () => {
  it('halaman di-refresh saat di entri dalam: satu kali Back tetap keluar dari aplikasi', async () => {
    // riwayat sebelum refresh: [halaman lain, dasar(0), dalam(1), dalam(2)]; refresh terjadi di entri terakhir
    const stale = [{ mdr: 0, sid: 'lama' }, { mdr: 1, sid: 'lama' }, { mdr: 2, sid: 'lama' }];
    const b = fakeBrowser({ staleEntries: stale.slice(0, 2) });
    // entri aplikasi saat dimuat membawa state lama {mdr:2}
    b.win.history.replaceState({ mdr: 2, sid: 'lama' });
    const bs = createBackStack(b.win);
    bs.register(() => {}); await tick();                         // aplikasi mulai: entri dijadikan dasar baru
    expect(bs.snapshot()).toMatchObject({ layers: 1, depth: 1 });
    bs.unregister(1); await tick();                              // layar kembali ke Beranda
    b.userBack(); await tick(80);
    expect(b.left).toBe(true);                                   // melewati semua entri basi, keluar
  });

  it('lapisan terbuka lalu Back menembus ke entri basi: lapisan ikut ditutup, lalu keluar', async () => {
    const b = fakeBrowser({ staleEntries: [{ mdr: 0, sid: 'lama' }] });
    const bs = createBackStack(b.win); let closed = 0;
    bs.register(() => { closed += 1; }); await tick();
    b.userBack(); await tick();                                  // menutup lapisan (entri dasar baru)
    expect(closed).toBe(1); expect(b.left).toBe(false);
    b.userBack(); await tick(80);                                // entri basi → dilewati → keluar
    expect(b.left).toBe(true);
  });

  it('lingkungan tanpa window/history (mis. server): tidak error dan tidak melakukan apa-apa', async () => {
    const bs = createBackStack(null);
    const id = bs.register(() => {}); bs.unregister(id); await tick();
    expect(bs.snapshot()).toMatchObject({ layers: 0, depth: 0 });
  });
});

describe('backStack — refresh di entri dalam (lompat ke entri dasar)', () => {
  const lama = { mdr: 2, sid: 'lama' };

  it('di-refresh saat di entri dalam: langsung go(-mdr) ke entri dasar, belum mulai (tidak replace, tidak pasang listener)', async () => {
    const b = fakeBrowser({ navType: 'reload', staleEntries: [{ mdr: 0, sid: 'lama' }, { mdr: 1, sid: 'lama' }] });
    b.win.history.replaceState(lama); b.log.length = 0;
    const bs = createBackStack(b.win);
    bs.init();
    expect(b.log).toEqual(['go-2']);
    expect(b.listeners).toBe(0);
  });

  it('sesudah lompat, dokumen baru dimuat di entri dasar (back_forward): satu kali Back = keluar dari aplikasi', async () => {
    const b = fakeBrowser({ navType: 'reload', staleEntries: [{ mdr: 0, sid: 'lama' }, { mdr: 1, sid: 'lama' }] });
    b.win.history.replaceState(lama);
    createBackStack(b.win).init();
    await tick();
    expect(b.index).toBe(1);                                      // [luar, dasar(basi mdr0), ...] -> berhenti di dasar
    // browser memuat ulang halaman di entri itu: modul baru, jenis navigasi bukan reload
    const win2 = { ...b.win, performance: { getEntriesByType: () => [{ type: 'back_forward' }] } };
    const bs2 = createBackStack(win2); bs2.init();
    expect(b.listeners).toBe(1);
    expect(b.state).toMatchObject({ mdr: 0 });
    b.userBack(); await tick();
    expect(b.left).toBe(true);
  });

  it('jenis navigasi bukan reload (buka lewat link / back_forward): TIDAK lompat, entri jadi dasar baru', async () => {
    for (const type of ['navigate', 'back_forward', 'prerender']) {
      const b = fakeBrowser({ navType: type });
      b.win.history.replaceState(lama); b.log.length = 0;
      const bs = createBackStack(b.win); bs.init();
      expect(b.log).toEqual(['replace']);
      expect(b.state).toMatchObject({ mdr: 0 });
      expect(b.listeners).toBe(1);
    }
  });

  it('di-refresh di entri dasar (mdr 0 / tanpa state): tidak lompat', async () => {
    for (const st of [null, { mdr: 0, sid: 'lama' }]) {
      const b = fakeBrowser({ navType: 'reload' });
      b.win.history.replaceState(st); b.log.length = 0;
      createBackStack(b.win).init();
      expect(b.log).toEqual(['replace']);
    }
  });

  it('browser tanpa Performance API: tidak error, jalan seperti biasa tanpa lompat', async () => {
    const b = fakeBrowser();                                      // tanpa performance sama sekali
    b.win.history.replaceState(lama); b.log.length = 0;
    expect(() => createBackStack(b.win).init()).not.toThrow();
    expect(b.log).toEqual(['replace']);
  });

  it('history.go melempar error saat lompat: lanjut mulai normal, tidak macet', async () => {
    const b = fakeBrowser({ navType: 'reload' });
    b.win.history.replaceState(lama);
    b.win.history.go = () => { throw new Error('SecurityError'); };
    const bs = createBackStack(b.win);
    expect(() => bs.init()).not.toThrow();
    expect(b.listeners).toBe(1);
    bs.register(() => {}); await tick();
    expect(bs.snapshot()).toMatchObject({ layers: 1, depth: 1 });
  });

  it('lompat hanya dicoba SEKALI per muatan halaman (init lalu register tidak melompat dua kali)', async () => {
    const b = fakeBrowser({ navType: 'reload', staleEntries: [{ mdr: 0, sid: 'lama' }, { mdr: 1, sid: 'lama' }] });
    b.win.history.replaceState(lama); b.log.length = 0;
    const bs = createBackStack(b.win);
    bs.init(); bs.register(() => {});
    expect(b.log.filter((l) => l === 'go-2').length).toBe(1);
  });
});

describe('backStack — kegagalan yang tidak boleh menjatuhkan aplikasi', () => {
  it('pushState melempar error (batas Safari): tidak macet, tidak error, Back berperilaku biasa', async () => {
    const b = fakeBrowser(); const orig = b.win.history.pushState; let n = 0;
    b.win.history.pushState = (...a) => { n += 1; throw new Error('SecurityError'); };
    const bs = createBackStack(b.win);
    bs.register(() => {}); await tick();
    expect(n).toBeGreaterThan(0);
    expect(bs.snapshot().depth).toBe(0);                         // tidak mengaku punya entri yang tidak ada
    b.win.history.pushState = orig;
  });

  it('close() yang melempar error tidak menghentikan penutupan lapisan lain', async () => {
    const b = fakeBrowser(); const bs = createBackStack(b.win); const order = [];
    bs.register(() => order.push('A'));
    bs.register(() => { order.push('B'); throw new Error('boom'); }); await tick();
    const spy = console.error; console.error = () => {};
    try { b.userBack(); await tick(); b.userBack(); await tick(); } finally { console.error = spy; }
    expect(order).toEqual(['B', 'A']);
  });
});
