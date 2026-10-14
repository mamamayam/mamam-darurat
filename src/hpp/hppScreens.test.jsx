import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { renderToString } from 'react-dom/server';
import { RAW } from './fixture';
import { buildModel } from './hppModel';
import LoginScreen from './LoginScreen.jsx';
import MenuTab from './MenuTab.jsx';
import BahanTab from './BahanTab.jsx';
import MenuSheet from './MenuSheet.jsx';
import BahanSheet from './BahanSheet.jsx';
import SettingsSheet from './SettingsSheet.jsx';
import { NumberField, Sheet, statusIsian, durasiKeluar, DURASI_KELUAR_MS } from './ui.jsx';

const render = (el) => renderToString(el).replace(/<!-- -->/g, '');
const noop = () => {};
const actions = new Proxy({}, { get: () => noop });
const model = buildModel(RAW);

describe('layar HPP (render server)', () => {
  it('login: email + password + Masuk, tanpa data HPP', () => {
    const html = render(<LoginScreen onMasuk={noop} />);
    expect(html).toContain('Mamam HPP');
    expect(html).toContain('Email');
    expect(html).toContain('Password');
    expect(html).toContain('Masuk');
    expect(html).toContain('Kembali ke POS');
    expect(html).not.toContain('Ayam');
  });

  it('tab Menu: pil margin, chip kategori, grup, modal dan margin per menu', () => {
    const html = render(<MenuTab model={model} onOpen={noop} onAcuan={noop} adaPerubahan={false} />);
    expect(html).toContain('Cari menu');
    expect(html).toContain('Margin LOW');
    expect(html).toContain('Margin HIGH');
    expect(html).not.toContain('Margin SEDANG');          // batas sama: tanpa SEDANG
    expect(html).toContain('Semua 2');
    expect(html).toContain('Paket Ayam');
    expect(html).toContain('Modal Rp1.730');
    expect(html).toContain('82,7% HIGH');
    expect(html).not.toContain('Jadikan harga sekarang sebagai acuan');
  });

  it('tab Menu: tombol acuan muncul saat ada perubahan; SEDANG muncul saat batas dipisah', () => {
    const m2 = buildModel({ ...RAW, setting: [{ key: 'margin', value: { lo: 40, hi: 60 } }] });
    const html = render(<MenuTab model={m2} onOpen={noop} onAcuan={noop} adaPerubahan />);
    expect(html).toContain('Margin SEDANG');
    expect(html).toContain('Jadikan harga sekarang sebagai acuan');
  });

  it('tab Harga bahan: kategori, harga, perubahan terakhir, dan bahan tanpa harga', () => {
    const html = render(<BahanTab model={model} onOpen={noop} />);
    expect(html).toContain('Cari bahan');
    expect(html).toContain('Primer');
    expect(html).toContain('Rp1.000');
    expect(html).toContain('▲ 25,0%');
    expect(html).toContain('dipakai di 1 menu');
    expect(html).toContain('Belum diisi');
    expect(html).toContain('Lainnya');                    // Garam tanpa kategori
  });

  it('popup menu: modal, komposisi, biaya lain, dan saran harga minimal bila belum HIGH', () => {
    const html = render(<MenuSheet model={model} menuId="m1" actions={actions} onClose={noop} />);
    expect(html).toContain('Rp1.730');
    expect(html).toContain('Komposisi modal');
    expect(html).toContain('Ayam goreng');
    expect(html).toContain('Biaya lain');
    expect(html).not.toContain('harga jual minimal');
    const low = buildModel({ ...RAW, setting: [{ key: 'margin', value: { lo: 90, hi: 90 } }] });
    expect(render(<MenuSheet model={low} menuId="m1" actions={actions} onClose={noop} />)).toContain('harga jual minimal Rp17.500');
  });

  it('popup bahan: harga, form ubah harga, menu terdampak, riwayat urut terbaru', () => {
    const html = render(<BahanSheet model={model} bahanId="A" actions={actions} perubahan={null} onClose={noop} />);
    expect(html).toContain('Harga sekarang');
    expect(html).toContain('Ubah harga per kg');
    expect(html).toContain('Menu terdampak · 1');
    expect(html).toContain('Paket Ayam');
    expect(html).toContain('Riwayat harga');
    expect(html).toContain('Naik 25,0% dari Rp800');
    expect(html).toContain('Harga awal');
    expect(html.indexOf('Naik')).toBeLessThan(html.indexOf('Harga awal'));
  });

  it('popup bahan: setelah perubahan menampilkan dampak sebelum → sesudah', () => {
    const naik = buildModel({ ...RAW, bahan: RAW.bahan.map((b) => (b.id === 'A' ? { ...b, harga: 2000 } : b)) });
    const html = render(<BahanSheet model={naik} bahanId="A" actions={actions} perubahan={{ bahanId: 'A', sebelum: 1000, sesudah: 2000 }} onClose={noop} />);
    expect(html).toContain('Dampak perubahan harga');
    expect(html).toContain('Rp1.000 → Rp2.000');
    expect(html).toContain('1 menu terdampak');
    expect(html).toContain('Rp1.730 → Rp1.860');
  });

  it('pengaturan: batas margin, harga online, dua editor kategori, tombol Keluar', () => {
    const html = render(<SettingsSheet model={model} actions={actions} email="owner@x.test" onKeluar={noop} onClose={noop} />);
    expect(html).toContain('Batas margin');
    expect(html).toContain('LOW jika margin di bawah');
    expect(html).toContain('HIGH jika margin mulai dari');
    expect(html).toContain('Harga online = outlet +');
    expect(html).toContain('Kategori bahan');
    expect(html).toContain('Kategori menu');
    expect(html).toContain('owner@x.test');
    expect(html).toContain('Keluar');
    expect(html).toContain('Saat ini: 0 LOW, 0 SEDANG, 2 HIGH dari 2 menu');
  });
});

describe('isian harga: tersimpan hanya lewat tombol Simpan', () => {
  it('statusIsian: belum diketik / valid beda / sama / tidak valid / negatif / kosong', () => {
    expect(statusIsian(null, 1000)).toEqual({ kotor: false, valid: false, bisaSimpan: false, nilai: null });
    expect(statusIsian('1.500', 1000)).toEqual({ kotor: true, valid: true, bisaSimpan: true, nilai: 1500 });
    expect(statusIsian('1000', 1000)).toMatchObject({ kotor: true, valid: true, bisaSimpan: false });    // sama dengan yang tersimpan
    expect(statusIsian('abc', 1000)).toMatchObject({ kotor: true, valid: false, bisaSimpan: false });
    expect(statusIsian('-5', 1000)).toMatchObject({ valid: false, bisaSimpan: false });
    expect(statusIsian('', 1000)).toMatchObject({ kotor: true, valid: false, bisaSimpan: false });       // dikosongkan: tidak boleh disimpan
    expect(statusIsian('500', null)).toMatchObject({ bisaSimpan: true });                                // bahan yang belum berharga
  });

  it('belum diubah: hanya kolom, tanpa tombol Simpan/Batal', () => {
    const html = render(<NumberField value={1000} ariaLabel="Harga Tes" onCommit={noop} />);
    expect(html).toContain('value="1000"');
    expect(html).not.toContain('Simpan');
    expect(html).not.toContain('Batal');
  });

  it('sudah diketik: muncul Simpan (aktif) dan Batal, nilai ketikan tampil', () => {
    const html = render(<NumberField value={1000} ariaLabel="Harga Tes" onCommit={noop} awal="1500" />);
    expect(html).toContain('value="1500"');
    expect(html).toContain('aria-label="Simpan Harga Tes"');
    expect(html).toContain('aria-label="Batal ubah Harga Tes"');
    expect(html).not.toMatch(/disabled=""[^>]*aria-label="Simpan Harga Tes"/);
  });

  it('ketikan tidak valid atau sama dengan yang tersimpan: Simpan nonaktif', () => {
    expect(render(<NumberField value={1000} ariaLabel="Harga Tes" onCommit={noop} awal="abc" />)).toMatch(/disabled=""[^>]*aria-label="Simpan Harga Tes"/);
    expect(render(<NumberField value={1000} ariaLabel="Harga Tes" onCommit={noop} awal="1000" />)).toMatch(/disabled=""[^>]*aria-label="Simpan Harga Tes"/);
    expect(render(<NumberField value={1000} ariaLabel="Harga Tes" onCommit={noop} awal="abc" />)).toContain('aria-invalid="true"');
  });

  it('satuan (suffix) ikut tampil di samping kolom', () => {
    expect(render(<NumberField value={1000} ariaLabel="Harga Tes" onCommit={noop} suffix={<i>/kg</i>} />)).toContain('<i>/kg</i>');
  });

  it('keluar dari kolom TIDAK menyimpan: tidak ada onBlur di NumberField', () => {
    const src = fs.readFileSync(new URL('./ui.jsx', import.meta.url), 'utf8');
    const nf = src.slice(src.indexOf('export function NumberField'), src.indexOf('/** Panel gelap'));
    expect(nf).not.toMatch(/onBlur/);
    expect(nf).toMatch(/onCommit\(s\.nilai\)/);
  });

  it('popup menu (belum ada yang diketik): tidak ada tombol Simpan yang menggantung', () => {
    expect(render(<MenuSheet model={model} menuId="m1" actions={actions} onClose={noop} />)).not.toContain('>Simpan<');
  });
});

describe('animasi popup HPP', () => {
  const css = fs.readFileSync(new URL('./hppSheet.css', import.meta.url), 'utf8');

  it('Sheet: latar dan panel memakai kelas animasi, belum dalam keadaan keluar', () => {
    const html = render(<Sheet title="Tes" onClose={noop}><p>isi</p></Sheet>);
    expect(html).toContain('hpp-overlay');
    expect(html).toContain('hpp-panel');
    expect(html).not.toContain('data-keluar');
    expect(html).toContain('role="dialog"');
  });

  it('keyframes masuk dan keluar ada untuk latar, lembar HP, dialog laptop; gerakan dikurangi dihormati', () => {
    for (const k of ['hpp-fade-in', 'hpp-fade-out', 'hpp-sheet-up', 'hpp-sheet-down', 'hpp-pop-in', 'hpp-pop-out', 'hpp-reveal', 'hpp-toast-in']) expect(css).toContain(`@keyframes ${k}`);
    expect(css).toContain('.hpp-panel[data-keluar]');
    expect(css).toContain('.hpp-overlay[data-keluar]');
    expect(css).toMatch(/@media \(min-width: 768px\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });

  it('durasi menunggu animasi keluar: 200 ms; 0 bila gerakan dikurangi atau tanpa matchMedia', () => {
    expect(DURASI_KELUAR_MS).toBe(200);
    expect(durasiKeluar(() => ({ matches: false }))).toBe(200);
    expect(durasiKeluar(() => ({ matches: true }))).toBe(0);
    expect(durasiKeluar(undefined)).toBe(200);
  });

  it('semua popup HPP memakai Sheet yang beranimasi (tidak ada dialog buatan sendiri)', () => {
    for (const f of ['MenuSheet.jsx', 'BahanSheet.jsx', 'SettingsSheet.jsx']) {
      const src = fs.readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
      expect(src, f).toMatch(/<Sheet\b/);
      expect(src, f).not.toMatch(/role="dialog"/);
    }
  });
});
