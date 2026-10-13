import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import LoginScreen from './LoginScreen.jsx';
import BahanTab from './BahanTab.jsx';
import ResepTab from './ResepTab.jsx';
import MenuTab from './MenuTab.jsx';

const render = (el) => renderToString(el).replace(/<!-- -->/g, '');

describe('layar HPP', () => {
  it('login: field email + password dan tombol Masuk, tanpa data HPP', () => {
    const html = render(<LoginScreen onLogin={() => {}} />);
    expect(html).toContain('Mamam HPP');
    expect(html).toContain('Email');
    expect(html).toContain('Password');
    expect(html).toContain('Masuk');
    expect(html).not.toContain('Fillet');
    expect(html).not.toContain('Firesauce');
  });
  it('bahan: 94 bahan dan 7 yang belum ada harganya', () => {
    const html = render(<BahanTab />);
    expect(html).toContain('94 dari 94 bahan');
    expect(html).toContain('7 belum ada harga');
    expect(html).toContain('Air Galon');
    expect(html).toContain('Rp22.000');
  });
  it('resep: judul tiap resep dan total, baris detail tertutup dulu', () => {
    const html = render(<ResepTab />);
    expect(html).toContain('Saos Firesauce');
    expect(html).toContain('Rp52.852');
    expect(html).not.toContain('Saos BBQ Delmonte');
  });
  it('menu: ringkasan, kolom, dan baris dari data', () => {
    const html = render(<MenuTab />);
    expect(html).toContain('Margin rata-rata');
    expect(html).toContain('Disarankan (30%)');
    expect(html).toContain('Rp14.153');
    expect(html).toContain('LOW');
    expect(html).toContain('HIGH');
  });
});
