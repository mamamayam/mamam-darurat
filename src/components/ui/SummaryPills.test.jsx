import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import SummaryPills from './SummaryPills';

const items = [{ key: 'Toko', label: 'TOKO · 2X', total: 1000 }, { key: 'Karyawan', label: 'KARYAWAN · 4X', total: 734500 }];
const render = (props) => renderToString(<SummaryPills items={items} allTotal={735500} value="semua" onChange={() => {}} negative {...props} />);

describe('SummaryPills — sensor nominal', () => {
  it('tanpa maskKeys: semua nominal tampil', () => {
    const html = render();
    expect(html).toContain('734.500');
    expect(html).toContain('735.500');
    expect(html).not.toContain('•');
  });
  it('maskKeys: pil yang disensor tidak membocorkan angka, pil lain tetap tampil', () => {
    const html = render({ maskKeys: ['Karyawan', 'semua'] });
    expect(html).not.toContain('734.500');
    expect(html).not.toContain('735.500');
    expect(html).toContain('KARYAWAN · 4X');   // label (jumlah catatan) tetap
    expect(html).toContain('Rp •••••');
    expect(html).toContain('1.000');            // nominal Toko tidak disensor
  });
});
