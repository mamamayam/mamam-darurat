import { describe, it, expect } from 'vitest';
import { BAHAN, RESEP, MENU, KELOMPOK_MENU } from './data/hppData';
import { buildMenu, computeRecipes, menuMetrics, recommendPrice, rowHpp, rupiah, angka } from './hppMath';

describe('format', () => {
  it('rupiah bulat dengan titik ribuan', () => {
    expect(rupiah(13622)).toBe('Rp13.622');
    expect(rupiah(1462.4)).toBe('Rp1.462');
    expect(rupiah(null)).toBe('-');
    expect(rupiah(-537)).toBe('-Rp537');
  });
  it('angka maksimal 1 desimal, koma Indonesia', () => {
    expect(angka(1410.5)).toBe('1.410,5');
    expect(angka(80)).toBe('80');
  });
});

describe('rowHpp', () => {
  it('komposisi / pembelian * harga', () => {
    expect(rowHpp(95, 1000, 56000)).toBeCloseTo(5320);
    expect(rowHpp(70, 3000, 23000)).toBeCloseTo(536.67, 1);
  });
  it('pembelian atau harga kosong = 0, bukan Infinity/NaN', () => {
    expect(rowHpp(10, 0, 5000)).toBe(0);
    expect(rowHpp(10, 100, 0)).toBe(0);
    expect(rowHpp(0, 100, 5000)).toBe(0);
  });
});

describe('computeRecipes — cocok dengan TOTAL di file', () => {
  const hit = computeRecipes(RESEP);

  it('semua resep yang punya total di file cocok (selisih maksimal Rp2 karena pembulatan)', () => {
    for (const r of RESEP.filter((x) => x.sheetTotal !== null && x.id !== 'sambal-geprek')) {
      expect(Math.abs(hit[r.id].total - r.sheetTotal), r.id).toBeLessThanOrEqual(2);
    }
  });

  it('Sambal Geprek: total file Rp64.860 tidak menghitung baris Gas (Rp537), selisih terdeteksi', () => {
    expect(hit['sambal-geprek'].sheetTotal).toBe(64860);
    expect(Math.round(hit['sambal-geprek'].total)).toBe(65397);
    expect(Math.round(hit['sambal-geprek'].selisih)).toBe(537);
  });

  it('baris dengan ref memakai total resep rujukan sebagai harga', () => {
    const ayam = hit['mamam-chicken'].rows.find((x) => x.nama === 'Tepung bumbu');
    expect(ayam.ref).toBe('tepung-bumbu');
    expect(ayam.harga).toBeCloseTo(hit['tepung-bumbu'].total);
    expect(Math.round(ayam.hpp)).toBe(1032);
    const top = hit.topping.rows.find((x) => x.nama === 'Firesauce');
    expect(top.refNama).toBe('Saos Firesauce');
    expect(Math.round(top.hpp)).toBe(881);
  });

  it('semua ref menunjuk resep yang ada', () => {
    const ids = new Set(RESEP.map((r) => r.id));
    for (const r of RESEP) for (const row of r.rows) if (row[4]) expect(ids.has(row[4]), `${r.id}/${row[0]}`).toBe(true);
  });

  it('resep yang saling merujuk tidak membuat loop tak hingga', () => {
    const loop = computeRecipes([
      { id: 'a', nama: 'A', grup: 'x', sheetTotal: null, batch: null, rows: [['b', 1, 1, 100, 'b']] },
      { id: 'b', nama: 'B', grup: 'x', sheetTotal: null, batch: null, rows: [['a', 1, 1, 100, 'a']] },
    ]);
    expect(Number.isFinite(loop.a.total)).toBe(true);
  });
});

describe('menu', () => {
  it('Ricebox Firesauce: HPP 14.153, outlet 20.000 -> 29,2% LOW, online 25.000', () => {
    const m = menuMetrics(14153, 20000);
    expect(m.profit).toBe(5847);
    expect(m.pct).toBeCloseTo(29.2, 1);
    expect(m.kategori).toBe('LOW');
    expect(m.online).toBe(25000);
    expect(Math.round(m.saran)).toBeGreaterThanOrEqual(20218);
    expect(Math.round(m.saran)).toBeLessThanOrEqual(20219);
  });
  it('Wingers: HPP 14.292, outlet 22.000 -> 35,0% HIGH, online 27.500', () => {
    const m = menuMetrics(14292, 22000);
    expect(m.pct).toBeCloseTo(35.0, 1);
    expect(m.kategori).toBe('HIGH');
    expect(m.online).toBe(27500);
  });
  it('batas HIGH tepat 30%', () => {
    expect(menuMetrics(7000, 10000).kategori).toBe('HIGH');
    expect(menuMetrics(7001, 10000).kategori).toBe('LOW');
  });
  it('recommendPrice: dibulatkan ke atas ke kelipatan 500; masukan tak valid = 0', () => {
    expect(recommendPrice(14153, 35)).toBe(22000);
    expect(recommendPrice(14153, 30)).toBe(20500);
    expect(recommendPrice(0, 30)).toBe(0);
    expect(recommendPrice(14153, 100)).toBe(0);
  });
  it('data menu: 54 menu, semua kelompok dikenal, HPP dan harga outlet positif', () => {
    expect(MENU).toHaveLength(54);
    for (const [k, nama, hpp, outlet] of MENU) {
      expect(KELOMPOK_MENU, nama).toContain(k);
      expect(hpp, nama).toBeGreaterThan(0);
      expect(outlet, nama).toBeGreaterThan(0);
    }
    const built = buildMenu(MENU);
    expect(built.filter((m) => m.kategori === 'HIGH').length).toBeGreaterThan(0);
  });
});

describe('data bahan', () => {
  it('94 bahan, nomor unik, harga null hanya untuk bahan yang memang kosong di file', () => {
    expect(BAHAN).toHaveLength(94);
    expect(new Set(BAHAN.map((b) => b[0])).size).toBe(94);
    expect(BAHAN.filter((b) => b[4] === null).map((b) => b[1]).sort()).toEqual([
      'Ketumbar Bubuk Desaku', 'Lychee Tea Kobe', 'Plastik Putih Susu Uk.30', 'Plastik Putih Susu Uk.40',
      'Stiker Cup', 'Stiker Packing Box', 'Tali Ripet/Kabel Ties 15cm',
    ]);
  });
  it('data tidak memuat nomor telepon atau daftar kontak', () => {
    const blob = JSON.stringify([BAHAN, RESEP, MENU]);
    expect(blob).not.toMatch(/0[0-9]{9,}/);
    expect(blob).not.toMatch(/Kak |Kontak/);
  });
});
