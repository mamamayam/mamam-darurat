/**
 * backStack — menyambungkan tombol Back browser/HP (dan geser-mundur di iPhone)
 * ke "lapisan" di dalam aplikasi, supaya Back MENUTUP lapisan teratas, bukan
 * langsung keluar dari aplikasi.
 *
 * Lapisan = apa pun yang bisa "ditutup" pengguna:
 *   - sub-layar / layar root selain Beranda (didaftarkan oleh App.jsx),
 *   - modal, laci keranjang, pembayaran, dsb. (didaftarkan lewat useBackLayer).
 * Urutan tutup: yang terakhir dibuka ditutup duluan (LIFO).
 *
 * Cara kerja: setiap lapisan punya SATU entri riwayat browser. Jumlah entri
 * (`depth`) selalu disamakan dengan jumlah lapisan:
 *   - lapisan bertambah  -> history.pushState
 *   - lapisan ditutup lewat tombol di layar (X, Batal, tap Beranda) -> history.go(-n)
 *     supaya tidak ada entri sisa yang membuat Back "tidak terjadi apa-apa"
 *   - pengguna menekan Back -> popstate -> lapisan teratas ditutup lewat close()
 * Di Beranda tanpa lapisan terbuka tidak ada entri tambahan, jadi Back
 * berperilaku biasa (keluar dari aplikasi).
 *
 * history.go() bersifat ASINKRON. Supaya pushState tidak menabrak go() yang
 * belum selesai, semua perubahan diserialkan: selama menunggu popstate dari go()
 * buatan sendiri (`traversing`), perubahan berikutnya ditunda lalu disamakan lagi.
 * Perubahan dalam satu tarikan napas (tutup modal + buka layar) digabung lewat
 * microtask, jadi tidak menghasilkan go() + pushState yang sia-sia.
 *
 * Modul ini tidak mengimpor React; `win` bisa diganti objek palsu untuk tes.
 */
export function createBackStack(win) {
  const layers = [];        // [{ id, close }] urutan dibuka
  let nextId = 1;
  let depth = 0;            // entri riwayat yang sudah kita buat di atas entri dasar
  let traversing = false;   // menunggu popstate dari history.go() buatan sendiri
  let scheduled = false;
  let started = false;
  let hopTried = false;
  let guardTimer = null;
  // Penanda unik muatan halaman ini. Entri riwayat dari muatan sebelumnya (mis. sebelum
  // refresh) membawa penanda lain, sehingga bisa dikenali sebagai entri BASI.
  const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);

  const usable = Boolean(win && win.history && typeof win.addEventListener === 'function');

  function start() {
    if (started || !usable) return;
    const st = win.history.state;
    const base = st && typeof st === 'object' ? st : {};

    // Halaman di-REFRESH saat berada di entri dalam (mis. di Kasir): entri riwayat sisa
    // dari muatan sebelumnya masih ada di belakang. Kalau dibiarkan, Back pertama hanya
    // memuat ulang aplikasi di entri sisa itu. Lompat langsung ke entri dasar; aplikasi
    // dimuat ulang di sana dengan riwayat yang bersih (satu Back = keluar).
    if (!hopTried && navigationType() === 'reload' && typeof base.mdr === 'number' && base.mdr > 0 && base.sid !== sid) {
      hopTried = true;
      try { win.history.go(-base.mdr); return; } catch { /* lanjut tanpa lompatan */ }
    }

    started = true;
    // Entri dasar = posisi saat aplikasi dimuat. Kalau halaman di-refresh saat
    // sedang di entri dalam, entri itu dijadikan dasar baru; entri-entri di
    // belakangnya tetap membawa penanda lama (basi) dan dilewati saat Back.
    try { win.history.replaceState({ ...base, mdr: 0, sid }, ''); } catch { /* abaikan */ }
    win.addEventListener('popstate', onPop);
  }

  function navigationType() {
    try { return win.performance.getEntriesByType('navigation')[0].type; } catch { return undefined; }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(() => { scheduled = false; sync(); });
  }

  /** Samakan jumlah entri riwayat dengan jumlah lapisan. */
  function sync() {
    if (!started || traversing) return;
    while (depth < layers.length) {
      depth += 1;
      try {
        win.history.pushState({ mdr: depth, sid }, '');
      } catch {
        depth -= 1;   // mis. batas pushState Safari: lanjut tanpa entri (Back biasa)
        break;
      }
    }
    if (depth > layers.length) {
      const diff = depth - layers.length;
      traversing = true;
      clearTimeout(guardTimer);
      // Jaga-jaga kalau popstate tidak pernah datang: jangan macet selamanya.
      guardTimer = setTimeout(() => {
        if (!traversing) return;
        traversing = false;
        depth = layers.length;
        schedule();
      }, 1500);
      win.history.go(-diff);
    }
  }

  function closeDownTo(n) {
    while (layers.length > n) {
      const top = layers.pop();
      try { top.close(); } catch (err) { console.error('[backStack] close gagal:', err); }
    }
  }

  function onPop(e) {
    const st = e && e.state;
    const mine = Boolean(st) && st.sid === sid && typeof st.mdr === 'number';

    // Hasil dari history.go() buatan sendiri.
    if (traversing) {
      traversing = false;
      clearTimeout(guardTimer);
      depth = mine ? st.mdr : 0;
      sync();
      return;
    }

    // Dari pengguna (Back / Forward / geser mundur).
    if (!mine) {
      // Mendarat di entri basi (sisa muatan sebelumnya): tutup semua lapisan lalu
      // lanjutkan mundur, supaya satu kali Back tetap berarti "keluar dari aplikasi".
      depth = 0;
      closeDownTo(0);
      try { win.history.back(); } catch { /* abaikan */ }
      return;
    }
    const target = st.mdr;
    depth = target;
    closeDownTo(target);
    // Kalau pengguna menekan Forward (target > jumlah lapisan), dikembalikan di sini.
    sync();
  }

  /** Daftarkan lapisan baru. `close` dipanggil saat pengguna menekan Back. Mengembalikan id. */
  function register(close) {
    start();
    const id = nextId++;
    layers.push({ id, close });
    schedule();
    return id;
  }

  /** Lapisan sudah ditutup lewat cara lain (tombol di layar). Aman dipanggil berulang. */
  function unregister(id) {
    const i = layers.findIndex((l) => l.id === id);
    if (i === -1) return;
    layers.splice(i, 1);
    schedule();
  }

  const has = (id) => layers.some((l) => l.id === id);
  const snapshot = () => ({ layers: layers.length, depth, traversing });

  return { init: start, register, unregister, has, snapshot };
}

/** Instans tunggal untuk aplikasi (tidak melakukan apa-apa di luar browser). */
export const backStack = createBackStack(typeof window !== 'undefined' ? window : null);
