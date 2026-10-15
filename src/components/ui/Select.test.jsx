import { describe, it, expect } from 'vitest';
import { Fragment } from 'react';
import { renderToString } from 'react-dom/server';
import { Select, collectSelectOptions } from './Input.jsx';

describe('collectSelectOptions', () => {
  it('membaca <option> biasa, array .map, Fragment, dan mengabaikan false/null', () => {
    const list = [{ id: 1, n: 'Ani' }, { id: 2, n: 'Budi' }];
    const opts = collectSelectOptions([
      <option key="a" value="">Pilih</option>,
      list.map(x => <option key={x.id} value={x.id}>{x.n}</option>),
      false && <option key="x" value="x">x</option>,
      null,
      <Fragment key="f"><option value="k" disabled>Kasir</option></Fragment>,
    ]);
    expect(opts).toEqual([
      { value: '', label: 'Pilih', disabled: false },
      { value: '1', label: 'Ani', disabled: false },
      { value: '2', label: 'Budi', disabled: false },
      { value: 'k', label: 'Kasir', disabled: true },
    ]);
  });
  it('label gabungan teks + angka dan value default = label', () => {
    expect(collectSelectOptions(<option>{3} jam</option>)).toEqual([{ value: '3 jam', label: '3 jam', disabled: false }]);
  });
});

describe('Select (bottom sheet)', () => {
  const html = (props) => renderToString(
    <Select label="Kategori" {...props}><option value="a">Ayam</option><option value="m">Minuman</option></Select>,
  );
  it('tombol menampilkan label pilihan aktif, bukan <select> bawaan', () => {
    const h = html({ value: 'm', 'data-testid': 'cat' });
    expect(h).not.toContain('<select');
    expect(h).toContain('Minuman');
    expect(h).toContain('aria-haspopup="listbox"');
    expect(h).toContain('data-testid="cat"');
  });
  it('disabled diteruskan ke tombol; bare tanpa label pembungkus', () => {
    expect(html({ value: 'a', disabled: true })).toMatch(/<button[^>]*disabled=""/);
    const bare = renderToString(<Select bare title="Role" value="a" className="x-class"><option value="a">Ayam</option></Select>);
    expect(bare).not.toContain('<label');
    expect(bare).toContain('x-class');
  });
  it('nilai tak dikenal = tombol kosong (tidak error)', () => {
    expect(() => html({ value: 'zzz' })).not.toThrow();
  });
});
