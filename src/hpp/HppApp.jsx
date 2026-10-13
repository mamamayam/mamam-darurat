import { useCallback, useEffect, useState } from 'react'
import LoginScreen from './LoginScreen'
import BahanTab from './BahanTab'
import ResepTab from './ResepTab'
import MenuTab from './MenuTab'
import { TABS, pathForTab, tabFromPath } from './hppRoutes'
import { clearSession, readSession, saveSession } from './hppAuth'

/**
 * Root HPP (path /hpp dan /hpp/*). Dimuat lewat React.lazy dari src/main.jsx, jadi menjadi
 * chunk terpisah dan TIDAK ikut terunduh di HP yang hanya membuka POS.
 *
 * ATURAN (lihat PRD Routing):
 *  - Berkas di src/hpp hanya boleh mengimpor dari src/hpp, `react`, atau `lucide-react`.
 *    Jangan menyentuh `lib/backStack`, `auth/*`, `app/*`, atau komponen POS (dijaga appMode.test.js).
 *  - Tombol Back = Back browser biasa (pushState biasa untuk pindah tab).
 *  - Login masih DUMMY (hppAuth.js). Ganti Supabase Auth + RLS sebelum data sungguhan.
 */
export default function HppApp() {
  const [user, setUser] = useState(() => readSession())
  const [tab, setTab] = useState(() => tabFromPath(window.location.pathname))

  useEffect(() => { document.title = 'Mamam HPP' }, [])
  useEffect(() => {
    const onPop = () => setTab(tabFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const goTab = useCallback((key) => {
    const path = pathForTab(key)
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
    setTab(key)
  }, [])

  const login = (email) => { saveSession(email); setUser(email) }
  const logout = () => { clearSession(); setUser(null) }

  return (
    <main className="fixed inset-0 overflow-y-auto bg-slate-50 font-body text-slate-800">
      {!user ? <LoginScreen onLogin={login} /> : (
        <>
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-lg font-bold">Mamam HPP</div>
                <div className="text-slate-500">{user}</div>
              </div>
              <div className="flex items-center gap-2">
                <a href="/" className="rounded-xl px-3 py-2 font-medium text-slate-500 hover:bg-slate-100">Ke POS</a>
                <button type="button" onClick={logout}
                  className="rounded-xl bg-slate-100 px-3 py-2 font-medium text-slate-600 active:scale-95 transition-all">Keluar</button>
              </div>
            </div>
            <nav className="mx-auto flex max-w-6xl gap-1 px-4" aria-label="Bagian HPP">
              {TABS.map((t) => (
                <button key={t.key} type="button" onClick={() => goTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}
                  className={`border-b-2 px-4 py-2.5 transition-colors ${tab === t.key ? 'border-accent-600 font-semibold text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  {t.label}
                </button>
              ))}
            </nav>
          </header>
          <div className="mx-auto max-w-6xl px-4 py-5 pb-12">
            {tab === 'bahan' && <BahanTab />}
            {tab === 'resep' && <ResepTab />}
            {tab === 'menu' && <MenuTab />}
          </div>
        </>
      )}
    </main>
  )
}
