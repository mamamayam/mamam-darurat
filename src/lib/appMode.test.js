import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isHppPath } from './appMode';

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
    expect(read('../app/layout/BottomSheetMenu.jsx')).toMatch(/window\.open\(item\.href, '_blank', 'noopener'\)/);
  });
});
