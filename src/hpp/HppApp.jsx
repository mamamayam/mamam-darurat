import { useEffect } from 'react'

/**
 * Root HPP (path /hpp dan /hpp/*). Dimuat lewat React.lazy dari src/main.jsx, jadi menjadi
 * chunk terpisah dan TIDAK ikut terunduh di HP yang hanya membuka POS.
 *
 * ATURAN (lihat PRD Routing):
 *  - Jangan mengimpor `lib/backStack`, `auth/AuthContext`, atau apa pun dari `app/` (POS).
 *    Tombol Back di HPP = Back browser biasa.
 *  - Hanya anon key Supabase; pembatasan data lewat RLS. Jangan simpan service key.
 *  - Jangan tampilkan data apa pun sebelum login (email + password, Supabase Auth) berhasil.
 *
 * Isi fitur HPP (login, tabel, rumus) dibahas di PRD terpisah. Ini masih PLACEHOLDER untuk
 * mencoba routing dari browser (bukan dari PWA).
 */
export default function HppApp() {
  useEffect(() => { document.title = 'Mamam HPP' }, [])
  const path = window.location.pathname

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-sm border border-slate-100 p-8 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl font-black">
          H
        </div>
        <h1 className="text-xl font-bold text-slate-800">Mamam HPP</h1>
        <p className="mt-1 text-sm text-slate-500">Halaman percobaan. Layar login dan penghitung HPP menyusul.</p>

        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-left text-xs text-slate-500">
          <div>Path: <span className="font-mono font-semibold text-slate-700" data-testid="hpp-path">{path}</span></div>
          <div className="mt-1">Coba refresh halaman ini, atau buka <span className="font-mono">/hpp/apa-saja</span>.</div>
        </div>

        <a
          href="/"
          className="mt-6 inline-block w-full rounded-2xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 active:scale-[0.98] transition-all"
        >
          Kembali ke POS
        </a>
      </div>
    </main>
  )
}
