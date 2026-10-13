/** Tab HPP <-> path. /hpp = tab Bahan; /hpp/resep; /hpp/menu. Path lain di bawah /hpp jatuh ke Bahan. */
export const TABS = [
  { key: 'bahan', label: 'Bahan', path: '/hpp' },
  { key: 'resep', label: 'Resep', path: '/hpp/resep' },
  { key: 'menu', label: 'Menu', path: '/hpp/menu' },
];

export function tabFromPath(pathname) {
  const clean = String(pathname || '').replace(/\/+$/, '');
  return TABS.find((t) => t.path === clean)?.key || 'bahan';
}

export function pathForTab(key) {
  return TABS.find((t) => t.key === key)?.path || '/hpp';
}
