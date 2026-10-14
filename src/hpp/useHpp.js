import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildModel } from './hppModel';
import * as repo from './hppRepo';

const KOSONG = { kategori: [], bahan: [], riwayat: [], resep: [], resepItem: [], menu: [], menuItem: [], setting: [] };

/**
 * State data HPP + semua aksi ubah data. `db` = klien Supabase (atau palsu saat tes).
 * Perubahan harga menunggu database menyimpan dulu (jangan tampilkan angka yang belum tersimpan).
 * Perubahan lain (kategori, margin, harga jual) langsung tampil lalu disimpan; kalau gagal, data dimuat ulang.
 */
export function useHpp(db) {
  const [raw, setRaw] = useState(KOSONG);
  const [status, setStatus] = useState('loading');   // loading | ready | error
  const [galat, setGalat] = useState(null);          // { pesan, setup }
  const [pesan, setPesan] = useState('');            // pesan kesalahan singkat setelah aksi
  const [perubahanTerakhir, setPerubahanTerakhir] = useState(null);   // { bahanId, sebelum, sesudah }
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const muat = useCallback(async () => {
    try {
      const data = await repo.loadAll(db);
      if (!mounted.current) return;
      setRaw(data); setStatus('ready'); setGalat(null);
    } catch (e) {
      if (!mounted.current) return;
      setGalat(repo.explainError(e.cause || e)); setStatus('error');
    }
  }, [db]);
  useEffect(() => { muat(); }, [muat]);

  const model = useMemo(() => buildModel(raw), [raw]);
  const patch = (fn) => setRaw((r) => fn(r));
  const gagal = (e) => { setPesan(e.message || 'Gagal menyimpan'); muat(); };
  const update = (tabel, id, kolom) => patch((r) => ({ ...r, [tabel]: r[tabel].map((x) => (x.id === id ? { ...x, ...kolom } : x)) }));

  const actions = {
    reload: muat,
    tutupPesan: () => setPesan(''),

    async ubahHarga({ bahanId, harga, catatan = '', sumber = 'manual' }) {
      const b = raw.bahan.find((x) => x.id === bahanId);
      if (!b || harga === null || Number.isNaN(harga) || harga < 0) return false;
      if (Number(b.harga) === harga) return false;
      try {
        await repo.ubahHarga(db, { bahanId, harga, catatan, sumber });
      } catch (e) { setPesan(e.message); return false; }
      const sebelum = b.harga === null ? null : Number(b.harga);
      setRaw((r) => ({
        ...r,
        bahan: r.bahan.map((x) => (x.id === bahanId ? { ...x, harga } : x)),
        riwayat: [{ id: `lokal-${Date.now()}`, bahan_id: bahanId, harga, harga_sebelum: sebelum, catatan: catatan || '', sumber, dibuat_pada: new Date().toISOString() }, ...r.riwayat],
      }));
      setPerubahanTerakhir({ bahanId, sebelum, sesudah: harga });
      return true;
    },

    async jadikanAcuan() {
      try { await repo.setAcuan(db); } catch (e) { setPesan(e.message); return; }
      patch((r) => ({ ...r, bahan: r.bahan.map((x) => ({ ...x, harga_acuan: x.harga })) }));
    },

    kategoriBahan(bahanId, kategoriId) {
      update('bahan', bahanId, { kategori_id: kategoriId });
      repo.ubahBahan(db, bahanId, { kategori_id: kategoriId }).catch(gagal);
    },
    kategoriMenu(menuId, kategoriId) {
      update('menu', menuId, { kategori_id: kategoriId });
      repo.ubahMenu(db, menuId, { kategori_id: kategoriId }).catch(gagal);
    },
    hargaJual(menuId, harga) {
      if (harga === null || harga < 0) return;
      update('menu', menuId, { harga_outlet: harga });
      repo.ubahMenu(db, menuId, { harga_outlet: harga }).catch(gagal);
    },
    biayaLain(menuId, biaya) {
      if (biaya === null || biaya < 0) return;
      update('menu', menuId, { biaya_lain: biaya });
      repo.ubahMenu(db, menuId, { biaya_lain: biaya }).catch(gagal);
    },

    async tambahKategori(jenis, nama) {
      const n = String(nama || '').trim();
      if (!n) return;
      const urutan = Math.max(0, ...raw.kategori.filter((k) => k.jenis === jenis).map((k) => Number(k.urutan))) + 1;
      try {
        const baru = await repo.tambahKategori(db, { jenis, nama: n, urutan });
        patch((r) => ({ ...r, kategori: [...r.kategori, baru] }));
      } catch (e) { setPesan(e.message); }
    },
    async ubahNamaKategori(id, nama) {
      const n = String(nama || '').trim();
      if (!n) return;
      try {
        await repo.ubahKategori(db, id, { nama: n });
        update('kategori', id, { nama: n });
      } catch (e) { setPesan(e.message); muat(); }
    },
    async hapusKategori(id) {
      try {
        await repo.hapusKategori(db, id);
        patch((r) => ({ ...r, kategori: r.kategori.filter((k) => k.id !== id) }));
      } catch (e) { setPesan(e.message); }
    },
    /** Tukar urutan dua kategori sejenis. */
    async tukarKategori(idA, idB) {
      const a = raw.kategori.find((k) => k.id === idA); const b = raw.kategori.find((k) => k.id === idB);
      if (!a || !b) return;
      update('kategori', idA, { urutan: b.urutan }); update('kategori', idB, { urutan: a.urutan });
      try {
        await Promise.all([repo.ubahKategori(db, idA, { urutan: b.urutan }), repo.ubahKategori(db, idB, { urutan: a.urutan })]);
      } catch (e) { gagal(e); }
    },

    simpanMargin(margin) {
      const value = { lo: margin.lo, hi: margin.hi };
      patch((r) => ({ ...r, setting: [...r.setting.filter((s) => s.key !== 'margin'), { key: 'margin', value }] }));
      repo.simpanSetting(db, 'margin', value).catch(gagal);
    },
    simpanMarkup(markup) {
      patch((r) => ({ ...r, setting: [...r.setting.filter((s) => s.key !== 'online_markup'), { key: 'online_markup', value: markup }] }));
      repo.simpanSetting(db, 'online_markup', markup).catch(gagal);
    },
  };

  return { model, status, galat, pesan, perubahanTerakhir, actions, raw };
}
