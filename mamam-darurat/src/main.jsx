import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.jsx'
import { backStack } from './lib/backStack'
import { AuthProvider } from './auth/AuthContext.jsx'
import './index.css'

// Sambungkan tombol Back sedini mungkin (sebelum React render) supaya kasus refresh
// di entri riwayat dalam bisa dibersihkan di awal.
backStack.init();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
