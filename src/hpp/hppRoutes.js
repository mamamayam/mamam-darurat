/** Tab HPP <-> path. /hpp = Menu; /hpp/bahan = Harga bahan. Path lain di bawah /hpp jatuh ke Menu. */
export const TABS = [
  { key: 'menu', label: 'Menu', path: '/hpp' },
  { key: 'bahan', label: 'Harga bahan', path: '/hpp/bahan' },
];

export function tabFromPath(pathname) {
  const clean = String(pathname || '').replace(/\/+$/, '');
  return TABS.find((t) => t.path === clean)?.key || 'menu';
}

export function pathForTab(key) {
  return TABS.find((t) => t.key === key)?.path || '/hpp';
}
