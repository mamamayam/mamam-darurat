import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.jsx'
import { backStack } from './lib/backStack'
import { AuthProvider } from './auth/AuthContext.jsx'
import ExitToast from './components/ui/ExitToast.jsx'
import { registerServiceWorker } from './lib/registerServiceWorker'
import './index.css'

// Sambungkan tombol Back sedini mungkin (sebelum React render) supaya kasus refresh
// di entri riwayat dalam bisa dibersihkan di awal.
backStack.init();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <ExitToast />
    </AuthProvider>
  </React.StrictMode>,
)

// PWA: hanya aktif di build produksi (lihat src/lib/registerServiceWorker.js).
registerServiceWorker();
