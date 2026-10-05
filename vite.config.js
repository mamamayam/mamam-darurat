import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'

// Vite config C — dipangkas dari mamam-global: TANPA plugin VitePWA.
// PWA-nya ditulis tangan di public/ (manifest.webmanifest, sw.js, icons/) dan didaftarkan
// lewat src/lib/registerServiceWorker.js. C online-first, jadi service worker HANYA
// menyimpan cangkang aplikasi, tidak pernah data (alasan sama dengan comment vite.config.js
// mamam-global soal kenapa *.supabase.co tidak boleh di-cache SW). Lihat comment di public/sw.js.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
