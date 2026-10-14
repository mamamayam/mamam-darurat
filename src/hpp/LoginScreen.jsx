import { useState } from 'react'

const field = 'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20'

/** Layar login HPP (Supabase Auth). Tidak menampilkan data apa pun sebelum berhasil masuk. */
export default function LoginScreen({ onMasuk }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [proses, setProses] = useState(false)

  const kirim = async (e) => {
    e.preventDefault()
    if (proses) return
    setProses(true); setError('')
    const hasil = await onMasuk(email, password)
    if (hasil?.error) setError(hasil.error)
    setProses(false)
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={kirim} noValidate className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
        <h1 className="font-heading text-xl font-bold text-slate-800">Mamam HPP</h1>
        <p className="mb-5 mt-1 text-slate-500">Masuk untuk membuka penghitung HPP</p>

        <label className="block text-slate-500" htmlFor="hpp-email">Email</label>
        <input id="hpp-email" type="email" autoComplete="username" className={`${field} mb-3 mt-1`}
          value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />

        <label className="block text-slate-500" htmlFor="hpp-password">Password</label>
        <input id="hpp-password" type="password" autoComplete="current-password" className={`${field} mt-1`}
          value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />

        <p role="alert" className="mt-2 min-h-5 text-red-600" data-testid="hpp-login-error">{error}</p>

        <button type="submit" disabled={proses}
          className="mt-1 w-full rounded-2xl bg-gradient-to-r from-accent-600 to-accent-500 py-2.5 font-bold text-white shadow-lg shadow-accent-500/30 transition-transform active:scale-[0.98] disabled:opacity-60">
          {proses ? 'Masuk…' : 'Masuk'}
        </button>
        <a href="/" className="mt-4 block text-center text-xs text-slate-400 hover:text-slate-600">← Kembali ke POS</a>
      </form>
    </div>
  )
}
