import { fmtDay, STATUS_LABEL, dayDetail, itemTitle } from './payrollReport';
import { formatRupiah as defaultRupiah } from '../../utils/formatters';

/**
 * payslipPdf — pembuat PDF slip gaji (mingguan & bulanan) TANPA library tambahan (PDF 1.4 tulis tangan,
 * font bawaan Helvetica). Teks asli (bisa dipilih/dicari), ukuran kecil, A4, otomatis
 * pindah halaman. FUNGSI MURNI: mengembalikan Uint8Array (dites).
 *
 * Hanya karakter Latin-1 yang dicetak; karakter lain diganti yang mirip (→ jadi >) atau "?".
 */

const PAGE_W = 595, PAGE_H = 842, M = 44, RIGHT = PAGE_W - M, LINE = 17;
const INK = [0.08, 0.1, 0.17], GRAY = [0.45, 0.48, 0.56], ACCENT = [0.91, 0.35, 0.05], RED = [0.82, 0.2, 0.29], GREEN = [0.06, 0.54, 0.29];

// Lebar karakter Helvetica (1000 unit/em) untuk ASCII 32..126. Tebal: HURUF dilebarkan ×1.06 (perkiraan);
// angka dan tanda baca sama dengan biasa (di Helvetica-Bold memang sama), jadi nominal tebal tetap rata kanan.
export const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584,
];

const clean = (s) => String(s ?? '')
  .replace(/\u00a0/g, ' ').replace(/→/g, '>').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\x20-\xff]/g, '?');

const charW = (c) => {
  const code = c.charCodeAt(0);
  if (code >= 32 && code <= 126) return WIDTHS[code - 32];
  if (code === 0xb7) return 278;
  if (code === 0xd7) return 584;
  return 556;
};
export const textWidth = (s, size, bold = false) =>
  [...clean(s)].reduce((w, c) => w + charW(c) * (bold && /[A-Za-z]/.test(c) ? 1.06 : 1), 0) * size / 1000;

const fit = (s, size, max, bold) => {
  let t = clean(s);
  if (textWidth(t, size, bold) <= max) return t;
  while (t.length > 1 && textWidth(`${t}...`, size, bold) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
};

const esc = (s) => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const num = (n) => (Math.round(n * 100) / 100).toString();
const rgb = (c) => `${c.map(num).join(' ')} rg`;

export function buildPayslipPdf({ business = 'Mamam Ayam', employeeName, periodLabel, report, withDays = false, formatRupiah = defaultRupiah }) {
  const pages = [[]];
  let y = PAGE_H - M;
  const page = () => pages[pages.length - 1];
  const need = (h) => { if (y - h < M + 24) { pages.push([]); y = PAGE_H - M; } };

  const text = (s, x, size, { bold = false, color = INK, align = 'left' } = {}) => {
    const t = clean(s);
    const px = align === 'right' ? x - textWidth(t, size, bold) : x;
    page().push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} ${num(px)} ${num(y)} Td (${esc(t)}) Tj ET`);
  };
  const rule = (weight = 0.5) => { page().push(`${weight} w 0.85 0.87 0.91 RG ${M} ${num(y)} m ${RIGHT} ${num(y)} l S`); };
  const row = (left, right, { bold = false, color = INK, rightColor = color, size = 10, indent = 0 } = {}) => {
    need(LINE);
    const rightW = textWidth(right, size, bold);
    text(fit(left, size, RIGHT - M - indent - rightW - 14, bold), M + indent, size, { bold, color });
    if (right) text(right, RIGHT, size, { bold, color: rightColor, align: 'right' });
    y -= LINE;
  };
  const section = (title) => { need(LINE * 2); y -= 6; text(title.toUpperCase(), M, 8, { bold: true, color: GRAY }); y -= LINE - 2; };

  // Kepala
  text(`Slip Gaji · ${business}`, M, 16, { bold: true }); y -= 20;
  text(`${employeeName} · ${periodLabel}`, M, 10, { color: GRAY }); y -= 14;
  rule(1); y -= 10;

  const shown = (r) => r.amount !== 0 || r.key === 'upah';
  section('Pendapatan');
  report.income.filter(shown).forEach((r) => row(r.label, formatRupiah(r.amount)));
  row('Total Pendapatan', formatRupiah(report.totalIncome), { bold: true });

  section('Pengurangan');
  const cuts = report.cuts.filter((r) => r.amount !== 0);
  if (cuts.length === 0) row('Tidak ada pengurangan', formatRupiah(0), { color: GRAY });
  cuts.forEach((r) => row(r.label, formatRupiah(-r.amount)));

  y -= 4; need(LINE * 2); rule(1); y -= 16;
  row('Gaji Bersih', formatRupiah(report.net), { bold: true, size: 13, rightColor: report.net < 0 ? RED : ACCENT });

  if (withDays) {
    section('Rincian Harian');
    for (const d of report.days) {
      const status = d.row ? STATUS_LABEL[d.row.status] || '' : '';
      row(`${fmtDay(d.date)}${status ? ` · ${status}` : ''}`, dayDetail(d.row), { bold: true, size: 9.5 });
      for (const it of d.items) {
        const plus = it.kind === 'tambahan';
        row(itemTitle(it), `${plus ? '+' : '-'}${formatRupiah(it.amount)}`, { size: 9, indent: 12, color: GRAY, rightColor: plus ? GREEN : RED });
      }
    }
  }

  // Kaki halaman (tahu total halaman setelah semua tersusun)
  pages.forEach((p, i) => {
    p.push(`BT /F1 8 Tf ${rgb(GRAY)} ${M} 28 Td (${esc(`Dibuat otomatis · ${business}`)}) Tj ET`);
    const pg = `Hal. ${i + 1}/${pages.length}`;
    p.push(`BT /F1 8 Tf ${rgb(GRAY)} ${num(RIGHT - textWidth(pg, 8))} 28 Td (${esc(pg)}) Tj ET`);
  });

  // Susun berkas PDF (1 karakter = 1 byte, jadi offset xref = panjang string)
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  pages.forEach((p, i) => {
    const content = p.join('\n');
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let out = '%PDF-1.4\n';
  const offsets = objs.map((body, i) => { const at = out.length; out += `${i + 1} 0 obj\n${body}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
