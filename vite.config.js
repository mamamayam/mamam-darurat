import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

// Versi app: nomor dari package.json (dinaikkan otomatis, lihat docs/versioning.md),
// plus hash commit & waktu build. Tampil di menu Lainnya dan layar login (src/lib/appVersion.js).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const gitSha = () => {
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' }
}
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || gitSha()).slice(0, 7)

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
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify({ sha, at: new Date().toISOString() }),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
