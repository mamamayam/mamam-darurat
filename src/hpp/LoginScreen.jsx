import { useState } from 'react'
import { DEMO_EMAIL, DEMO_PASSWORD, validateLogin } from './hppAuth'

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20'

/** Layar login HPP (dummy). Tidak menampilkan data apa pun sebelum berhasil masuk. */
export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const msg = validateLogin(email, password)
    if (msg) { setError(msg); return }
    setError('')
    onLogin(email.trim().toLowerCase())
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-7 shadow-sm" noValidate>
        <h1 className="text-xl font-bold text-slate-800">Mamam HPP</h1>
        <p className="mt-1 mb-5 text-slate-500">Masuk untuk membuka penghitung HPP</p>

        <label className="block text-slate-500" htmlFor="hpp-email">Email</label>
        <input id="hpp-email" type="email" autoComplete="username" className={`${field} mt-1 mb-3`}
          value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />

        <label className="block text-slate-500" htmlFor="hpp-password">Password</label>
        <input id="hpp-password" type="password" autoComplete="current-password" className={`${field} mt-1`}
          value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />

        <p role="alert" className="mt-2 min-h-5 text-red-600" data-testid="hpp-login-error">{error}</p>

        <button type="submit" className="mt-1 w-full rounded-xl bg-accent-600 py-2.5 font-semibold text-white active:scale-[0.98] transition-all">
          Masuk
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">Login percobaan: {DEMO_EMAIL} / {DEMO_PASSWORD}</p>
      </form>
    </div>
  )
}
