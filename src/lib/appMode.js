/**
 * Pemilih mode aplikasi: POS (staf, HP, login PIN) atau HPP (owner, laptop, login email).
 * Keduanya satu domain, satu build. HPP hidup di path `/hpp` dan `/hpp/*`; selain itu = POS.
 *
 * Dipanggil SEKALI di src/main.jsx saat startup. Jangan dicek ulang di dalam komponen.
 * Ini hanya pemilih tampilan: pembatasan data tetap lewat RLS di database, bukan lewat path.
 */
export function isHppPath(pathname) {
  return pathname === '/hpp' || (typeof pathname === 'string' && pathname.startsWith('/hpp/'));
}
