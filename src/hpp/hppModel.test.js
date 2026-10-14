import { describe, it, expect } from 'vitest';
import { RAW } from './fixture';
import {
  buildModel, ctxAcuan, dampakHarga, hargaMinimal, kelompokkan, makeCtx, marginPct, menuBahanKosong, menuInfo,
  menuParts, menusUsingBahan, perubahanTerakhir, resepRows, tierOf, tiersFor,
} from './hppModel';

const model = () => buildModel(RAW);

describe('hitung biaya (angka tangan)', () => {
  it('harga per unit dasar = harga / isi', () => {
    const c = makeCtx(model());
    expect(c.unitCost('A')).toBe(1);
    expect(c.unitCost('B')).toBe(1000);
    expect(c.unitCost('tidak-ada')).toBe(0);
  });

  it('resep batch: total = jumlah baris; dipakai sebagian = qty / hasil * total', () => {
    const c = makeCtx(model());
    expect(c.resepTotal('saos')).toBe(2600);              // 600 gr ayam + 2 kemasan
    expect(c.resepCost('saos', 50)).toBeCloseTo(130);     // 50 dari batch 1000 gr
    expect(c.resepTotal('porsi')).toBeCloseTo(230);       // 130 saos + 100 ayam
  });

  it('HPP menu = komponen + biaya lain', () => {
    const m = model(); const c = makeCtx(m);
    expect(c.menuHpp(m.menu[0])).toBeCloseTo(1730);       // 230 + 1000 + 500
    expect(c.menuHpp(m.menu[1])).toBe(1000);
  });

  it('margin dan kategori', () => {
    const m = model(); const c = makeCtx(m);
    const i = menuInfo(m, c, m.menu[0]);
    expect(i.pct).toBeCloseTo(82.7, 1);
    expect(i.profit).toBeCloseTo(8270);
    expect(i.online).toBeCloseTo(12500);
    expect(i.tier).toBe('HIGH');
    expect(menuInfo(m, c, m.menu[1]).tier).toBe('HIGH');   // 50% >= 30
    expect(marginPct(0, 100)).toBe(0);
  });

  it('batas margin: sama = HIGH/LOW; terpisah = ada SEDANG; tepat di batas = HIGH', () => {
    expect(tierOf(30, { lo: 30, hi: 30 })).toBe('HIGH');
    expect(tierOf(29.9, { lo: 30, hi: 30 })).toBe('LOW');
    expect(tierOf(50, { lo: 40, hi: 60 })).toBe('SEDANG');
    expect(tierOf(60, { lo: 40, hi: 60 })).toBe('HIGH');
    expect(tierOf(39.9, { lo: 40, hi: 60 })).toBe('LOW');
    expect(tiersFor({ lo: 30, hi: 30 })).toEqual(['LOW', 'HIGH']);
    expect(tiersFor({ lo: 25, hi: 30 })).toEqual(['LOW', 'SEDANG', 'HIGH']);
  });

  it('batas margin tersimpan dipakai model; lo > hi dirapikan', () => {
    const m = buildModel({ ...RAW, setting: [{ key: 'margin', value: { lo: 50, hi: 40 } }] });
    expect(m.margin).toEqual({ lo: 40, hi: 40 });
    expect(buildModel({ ...RAW, setting: [] }).margin).toEqual({ lo: 30, hi: 30 });
    expect(buildModel({ ...RAW, setting: [] }).markup).toBe(1.25);
  });

  it('hargaMinimal dibulatkan ke atas kelipatan 500; masukan tak valid = 0', () => {
    expect(hargaMinimal(1730, 30)).toBe(2500);
    expect(hargaMinimal(14153, 30)).toBe(20500);
    expect(hargaMinimal(0, 30)).toBe(0);
    expect(hargaMinimal(1000, 100)).toBe(0);
  });
});

describe('struktur', () => {
  it('menu memakai bahan: langsung dan lewat resep bertingkat', () => {
    const m = model();
    expect(menusUsingBahan(m, 'A').map((x) => x.id)).toEqual(['m1']);          // via saos dan porsi
    expect(menusUsingBahan(m, 'B').map((x) => x.id)).toEqual(['m1', 'm2']);    // langsung + via saos
    expect(menusUsingBahan(m, 'C')).toEqual([]);
  });

  it('komponen menu urut biaya terbesar, biaya lain di akhir', () => {
    const m = model(); const c = makeCtx(m);
    const p = menuParts(m, c, m.menu[0]);
    expect(p.map((x) => x.nama)).toEqual(['Kemasan', 'Ayam goreng', 'Biaya lain (sisa dari file)']);
    expect(p.reduce((s, x) => s + x.biaya, 0)).toBeCloseTo(1730);
  });

  it('isi resep memuat bahan dan sub-resep dengan biayanya', () => {
    const m = model(); const c = makeCtx(m);
    const rows = resepRows(m, c, 'porsi');
    expect(rows.map((r) => [r.kind, r.nama, Math.round(r.biaya)])).toEqual([['resep', 'Saos', 130], ['bahan', 'Ayam', 100]]);
  });

  it('resep yang saling merujuk tidak membuat loop tak hingga', () => {
    const raw = { ...RAW,
      resep: [...RAW.resep, { id: 'x', nama: 'X', grup: 'g', hasil_qty: null }, { id: 'y', nama: 'Y', grup: 'g', hasil_qty: null }],
      resepItem: [...RAW.resepItem,
        { id: 'c1', resep_id: 'x', urutan: 1, bahan_id: null, sub_resep_id: 'y', qty: 1 },
        { id: 'c2', resep_id: 'y', urutan: 1, bahan_id: null, sub_resep_id: 'x', qty: 1 },
        { id: 'c3', resep_id: 'y', urutan: 2, bahan_id: 'A', qty: 10, sub_resep_id: null }],
    };
    const m = buildModel(raw);
    expect(Number.isFinite(makeCtx(m).resepTotal('x'))).toBe(true);
    expect(menusUsingBahan({ ...m, menu: [{ ...m.menu[0], items: [{ resepId: 'x', bahanId: null, qty: 1 }] }] }, 'A')).toHaveLength(1);
  });

  it('bahan tanpa harga dihitung 0 dan dilaporkan', () => {
    const raw = { ...RAW, resepItem: [...RAW.resepItem, { id: 'i9', resep_id: 'porsi', urutan: 3, bahan_id: 'C', sub_resep_id: null, qty: 5 }] };
    const m = buildModel(raw);
    expect(makeCtx(m).resepTotal('porsi')).toBeCloseTo(230);
    expect(menuBahanKosong(m, m.menu[0])).toEqual(['Garam']);
    expect(menuBahanKosong(m, m.menu[1])).toEqual([]);
  });

  it('kelompokkan: urutan kategori, item tanpa kategori masuk Lainnya, grup kosong dibuang', () => {
    const m = model();
    const g = kelompokkan(m.bahanList, m.kategoriBahan, (b) => b.kategoriId);
    expect(g.map((x) => [x.nama, x.items.map((b) => b.nama)])).toEqual([['Primer', ['Ayam']], ['Packaging', ['Kemasan']], ['Lainnya', ['Garam']]]);
  });
});

describe('dampak perubahan harga dan acuan', () => {
  it('ayam 1000 -> 2000: menu terdampak dihitung sebelum dan sesudah', () => {
    const raw = { ...RAW, bahan: RAW.bahan.map((b) => (b.id === 'A' ? { ...b, harga: 2000 } : b)) };   // harga SEKARANG 2000
    const d = dampakHarga(buildModel(raw), 'A', 1000);
    expect(d.rows).toHaveLength(1);
    const r = d.rows[0];
    expect(r.sebelum.hpp).toBeCloseTo(1730);
    expect(r.sesudah.hpp).toBeCloseTo(1860);     // saos 3200, 50 gr = 160; porsi 160 + 200; + 1000 + 500
    expect(r.selisih).toBeCloseTo(130);
    expect(r.ganti).toBe(false);
  });

  it('menandai menu yang berpindah kategori margin', () => {
    const raw = {
      ...RAW,
      setting: [{ key: 'margin', value: { lo: 82, hi: 82 } }],
      bahan: RAW.bahan.map((b) => (b.id === 'A' ? { ...b, harga: 2000 } : b)),
    };
    const d = dampakHarga(buildModel(raw), 'A', 1000);
    expect(d.rows[0].sebelum.tier).toBe('HIGH');   // 82,7%
    expect(d.rows[0].sesudah.tier).toBe('LOW');    // 81,4%
    expect(d.ganti).toBe(1);
  });

  it('acuan: selisih modal terhadap harga acuan', () => {
    const raw = { ...RAW, bahan: RAW.bahan.map((b) => (b.id === 'A' ? { ...b, harga_acuan: 500 } : b)) };
    const m = buildModel(raw);
    const now = makeCtx(m).menuHpp(m.menu[0]);
    const acuan = ctxAcuan(m).menuHpp(m.menu[0]);
    expect(now - acuan).toBeCloseTo(0.5 * 1000 * 0.6 * 0.05 + 0.5 * 100, 5);   // ayam 500 lebih murah per kg
  });

  it('perubahan terakhir dari riwayat', () => {
    const m = model();
    const p = perubahanTerakhir(m, 'A');
    expect(p.persen).toBeCloseTo(25);
    expect(p.dari).toBe(800);
    expect(perubahanTerakhir(m, 'B')).toBeNull();
    expect(m.riwayat.A.map((r) => r.id)).toEqual(['r2', 'r1']);   // terbaru dulu
  });
});
