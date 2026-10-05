/**
 * Mendaftarkan service worker (public/sw.js) supaya aplikasi bisa dipasang sebagai PWA.
 * Hanya di build produksi: `npm run dev` tidak memakai service worker, jadi perubahan kode
 * langsung terlihat dan tidak ada cache yang membingungkan saat mengembangkan.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const base = import.meta.env.BASE_URL || '/';
  const register = () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      .catch((err) => console.warn('[PWA] service worker gagal didaftarkan:', err));
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
