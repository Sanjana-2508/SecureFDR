import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShieldCheck, Mail, Lock } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { errMsg } from '../api'

const DEMO = [
  { label: 'Institution', email: 'sunrise@inst.in' },
  { label: 'Officer', email: 'officer1@aicte.in' },
  { label: 'Admin', email: 'admin@securefdr.in' },
]

export default function Login() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try { const u = await login(email, password); toast.success(`Welcome, ${u.name}`); nav('/') }
    catch (err) { toast.error(errMsg(err)) }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center p-16 bg-gradient-to-br from-slate-900 via-blue-900 to-blue-700 text-white">
        <ShieldCheck size={56} className="text-sky-300 mb-6" />
        <h1 className="text-5xl font-bold mb-4">SecureFDR</h1>
        <p className="text-lg text-blue-100 max-w-md">One secure portal for the complete lifecycle of institutional FDRs and security deposits — submission, verification, maturity tracking and release.</p>
        <ul className="mt-8 space-y-2 text-blue-200 text-sm">
          <li>✔ Role-based secure access</li><li>✔ Centralized FDR repository</li>
          <li>✔ Automated maturity alerts</li><li>✔ Complete audit trail</li>
        </ul>
      </div>
      <div className="flex items-center justify-center p-6 bg-base-100">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div><h2 className="text-3xl font-bold">Sign in</h2><p className="text-slate-500 text-sm mt-1">Access your SecureFDR account</p></div>
          <label className="input input-bordered flex items-center gap-2"><Mail size={16} className="opacity-50" />
            <input type="email" className="grow" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="input input-bordered flex items-center gap-2"><Lock size={16} className="opacity-50" />
            <input type="password" className="grow" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? <span className="loading loading-spinner" /> : 'Sign in'}</button>
          <div className="divider text-xs text-slate-400">DEMO ACCOUNTS (password: demo123)</div>
          <div className="flex gap-2">
            {DEMO.map((d) => (
              <button type="button" key={d.label} className="btn btn-outline btn-sm flex-1" onClick={() => { setEmail(d.email); setPassword('demo123') }}>{d.label}</button>
            ))}
          </div>
        </form>
      </div>
    </div>
  )
}
