/**
 * appVersion — versi app untuk ditampilkan. Nilainya disuntik saat build oleh
 * vite.config.js (define): __APP_VERSION__ dari package.json, __APP_BUILD__ berisi
 * hash commit dan waktu build. Di luar build (mis. tes) jatuh ke 'dev'.
 */
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const two = (n) => String(n).padStart(2, '0');

/** ISO UTC -> "7 Okt 09.30" dalam WIB (UTC+7), tanpa bergantung pada pengaturan zona perangkat. */
export function formatBuildTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + 7 * 3600 * 1000);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${two(d.getUTCHours())}.${two(d.getUTCMinutes())}`;
}

/** "v0.1.0 · 7 Okt 09.30 · ab12cd3" — bagian yang tidak tersedia dilewati. */
export function formatVersionLabel(version, build = {}) {
  const parts = [version && version !== 'dev' ? `v${version}` : 'dev'];
  const when = formatBuildTime(build.at);
  if (when) parts.push(when);
  if (build.sha) parts.push(build.sha);
  return parts.join(' · ');
}

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : {};

export const versionLabel = () => formatVersionLabel(APP_VERSION, BUILD);
