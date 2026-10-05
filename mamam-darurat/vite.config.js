import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'

// Vite config C — dipangkas dari mamam-global: TANPA VitePWA/service worker.
// C online-first, jadi caching offline justru kontraproduktif (sama alasan
// yang dijelaskan di comment vite.config.js mamam-global soal kenapa
// *.supabase.co tidak boleh di-cache SW).
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
