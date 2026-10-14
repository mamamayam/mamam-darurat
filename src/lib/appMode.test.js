import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isHppPath, leaveForHref, shouldReloadOnReturn } from './appMode';

const read = (rel) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('isHppPath — pemilih mode POS / HPP', () => {
  it.each(['/hpp', '/hpp/', '/hpp/bahan', '/hpp/resep/12'])('%s = HPP', (p) => {
    expect(isHppPath(p)).toBe(true);
  });

  it.each(['/', '/index.html', '/hppx', '/hpp-lama', '/kasir/hpp', '/HPP', ''])('%s = POS', (p) => {
    expect(isHppPath(p)).toBe(false);
  });
});

describe('pemisahan jalur POS dan HPP', () => {
  const main = read('../main.jsx');

  it('HppApp dimuat lazy dan tidak diimpor statis oleh main.jsx', () => {
    expect(main).toMatch(/lazy\(\(\) => import\('\.\/hpp\/HppApp\.jsx'\)\)/);
    expect(main).not.toMatch(/^import .* from ['"]\.\/hpp\//m);
  });

  it('tidak ada berkas POS yang mengimpor src/hpp', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = `${dir}/${d.name}`;
      return d.isDirectory() ? walk(p) : [p];
    });
    const root = fileURLToPath(new URL('..', import.meta.url));
    const offenders = walk(root)
      .filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.includes('/hpp/') && !f.endsWith('main.jsx') && !f.endsWith('.test.js'))
      .filter((f) => /from ['"][^'"]*\/hpp\//.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('HppApp tidak menyentuh backStack, AuthContext, atau kode POS', () => {
    const hpp = read('../hpp/HppApp.jsx').split('\n').filter((l) => /^\s*import /.test(l)).join('\n');
    expect(hpp).not.toMatch(/backStack|AuthContext|\/app\/|ExitToast|ConnectionBanner/);
  });

  it('main.jsx: backStack, service worker, dan AuthProvider hanya di cabang POS', () => {
    const hppBranch = main.slice(main.indexOf('if (isHpp) {'), main.indexOf('} else {')).replace(/\/\/.*$/gm, '');
    expect(hppBranch).not.toMatch(/backStack|registerServiceWorker|AuthProvider|ExitToast/);
  });

  it('vercel.json mengarahkan semua path ke index.html (refresh /hpp tidak 404)', () => {
    const cfg = JSON.parse(read('../../vercel.json'));
    expect(cfg.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('manifest tetap start_url "/" dan tidak menyebut /hpp', () => {
    const m = JSON.parse(read('../../public/manifest.webmanifest'));
    expect(m.start_url).toBe('/');
    expect(JSON.stringify(m)).not.toContain('/hpp');
  });
});

describe('tombol HPP di menu Lainnya', () => {
  it('izin screen.hpp hanya untuk owner, jadi staf tidak melihat tombolnya', async () => {
    const { can, VIEW_PERMISSION } = await import('../auth/permissions.js');
    expect(VIEW_PERMISSION.hpp).toBe('screen.hpp');
    expect(can('owner', 'screen.hpp')).toBe(true);
    expect(can('staff', 'screen.hpp')).toBe(false);
  });

  it('menu HPP berupa tautan ke /hpp (bukan layar POS)', () => {
    expect(read('../app/App.jsx')).toMatch(/id: 'hpp',[^\n]*href: '\/hpp'/);
    expect(read('../app/layout/BottomSheetMenu.jsx')).toMatch(/leaveForHref\(item\.href\)/);
    expect(read('../app/layout/BottomSheetMenu.jsx')).not.toMatch(/window\.open/);
  });
});

describe('src/hpp berdiri sendiri (tanpa kode POS)', () => {
  const root = fileURLToPath(new URL('../hpp', import.meta.url));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = `${dir}/${d.name}`;
    return d.isDirectory() ? walk(p) : [p];
  });
  const files = walk(root).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f));

  it('berkas HPP hanya mengimpor sesama src/hpp, react, lucide-react, atau @supabase/supabase-js', () => {
    expect(files.length).toBeGreaterThan(3);
    const bad = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        const ok = spec === 'react' || spec === 'lucide-react' || spec === '@supabase/supabase-js' || spec.startsWith('react/')
          || (spec.startsWith('./') && !spec.includes('..'));
        if (!ok) bad.push(`${f.replace(root, 'src/hpp')}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('pindah ke HPP di tab yang sama (Back kembali ke POS)', () => {
  const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

  it('leaveForHref memakai location.replace (bukan buka tab baru) dan memasang penanda', () => {
    const calls = [];
    const win = { sessionStorage: store(), location: { replace: (u) => calls.push(u) }, open: () => calls.push('OPEN') };
    leaveForHref('/hpp', win);
    expect(calls).toEqual(['/hpp']);
    expect(shouldReloadOnReturn(true, win.sessionStorage)).toBe(true);
  });

  it('leaveForHref tetap pindah walau sessionStorage diblokir', () => {
    const calls = [];
    const rusak = { setItem() { throw new Error('x'); }, getItem() { throw new Error('x'); }, removeItem() {} };
    leaveForHref('/hpp', { sessionStorage: rusak, location: { replace: (u) => calls.push(u) } });
    expect(calls).toEqual(['/hpp']);
  });

  it('muat ulang hanya jika halaman dipulihkan dari cache SETELAH pergi ke HPP; penanda sekali pakai', () => {
    const s = store();
    expect(shouldReloadOnReturn(true, s)).toBe(false);    // tanpa penanda: pemulihan biasa dibiarkan
    s.setItem('mamam-leaving-for-hpp', '1');
    expect(shouldReloadOnReturn(false, s)).toBe(false);   // muatan baru: tidak perlu reload
    expect(shouldReloadOnReturn(true, s)).toBe(false);    // penanda sudah dihapus tadi
    s.setItem('mamam-leaving-for-hpp', '1');
    expect(shouldReloadOnReturn(true, s)).toBe(true);
    expect(shouldReloadOnReturn(true, s)).toBe(false);
  });

  it('main.jsx memasang pageshow hanya di cabang POS', () => {
    const main = read('../main.jsx');
    const hppBranch = main.slice(main.indexOf('if (isHpp) {'), main.indexOf('} else {')).replace(/\/\/.*$/gm, '');
    expect(main).toMatch(/addEventListener\('pageshow'/);
    expect(hppBranch).not.toMatch(/pageshow|shouldReloadOnReturn/);
  });
});
