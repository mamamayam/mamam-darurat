import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Penjaga standar tombol (lihat Button.jsx): hanya tiga varian baku —
 * primary (aksi utama), secondary (pendukung), danger (hanya merusak/hapus).
 * Tes ini gagal kalau ada <Button variant="..."> di luar itu (mis. 'success', 'dark', 'ghost'),
 * supaya warna tombol tidak melebar lagi jadi macam-macam per layar.
 */

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const ALLOWED = ['primary', 'secondary', 'danger'];

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(jsx|js)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

// Isi tag pembuka <Button ...> sampai '>' penutupnya (mengabaikan '=>' dan '>' di dalam {...}).
function buttonTags(source) {
  const tags = [];
  const re = /<Button\b/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < source.length; i += 1) {
      const c = source[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0 && source[i - 1] !== '=') break;
    }
    tags.push({ text: source.slice(m.index, i + 1), line: source.slice(0, m.index).split('\n').length });
  }
  return tags;
}

// Semua nilai teks yang dipakai variant: variant="x" atau variant={cond ? 'a' : 'b'}.
function variantValues(tag) {
  const out = [];
  const lit = tag.match(/\bvariant="([^"]*)"/);
  if (lit) out.push(lit[1]);
  const expr = tag.match(/\bvariant=\{([^}]*)\}/);
  if (expr) for (const q of expr[1].matchAll(/['"]([^'"]*)['"]/g)) out.push(q[1]);
  return out;
}

describe('standar tombol', () => {
  it('Button.jsx hanya punya tiga varian baku', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/ui/Button.jsx'), 'utf8');
    const block = src.slice(src.indexOf('const VARIANTS = {'), src.indexOf('const SIZES'));
    const keys = [...block.matchAll(/^ {2}['"]?([a-z-]+)['"]?:\s*`/gm)].map((m) => m[1]);
    expect(keys).toEqual(ALLOWED);
  });

  it('semua <Button variant="..."> di app memakai varian baku', () => {
    const bad = [];
    for (const file of sourceFiles(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const tag of buttonTags(source)) {
        for (const v of variantValues(tag.text)) {
          if (!ALLOWED.includes(v)) bad.push(`${path.relative(SRC, file)}:${tag.line} variant="${v}"`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('pendeteksi tag bekerja (ada cukup banyak <Button> yang diperiksa)', () => {
    let total = 0;
    for (const file of sourceFiles(SRC)) total += buttonTags(fs.readFileSync(file, 'utf8')).length;
    expect(total).toBeGreaterThan(40);
  });
});
