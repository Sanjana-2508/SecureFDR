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
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden border-r border-slate-200 bg-white px-12 py-14 lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-primary">
            <ShieldCheck size={25} />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-slate-900">
              SecureFDR
            </div>
            <div className="text-xs text-slate-500">AICTE Deposit Portal</div>
          </div>
        </div>
        <div className="relative z-10 max-w-xl py-16">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            Institutional deposit management
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 xl:text-5xl">
            Clarity across the full FDR lifecycle.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
            Manage institutional security deposits with a secure workflow for submission, verification, maturity monitoring, renewal, and release.
          </p>
          <ul className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">Role-based access</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">Centralized FDR records</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">Maturity monitoring</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">Auditable workflows</li>
          </ul>
        </div>
        <p className="text-xs text-slate-400">
          SecureFDR · AICTE Security Deposit Management Portal
        </p>
      </div>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5 sm:p-8">
        <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="mb-7 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-primary">
              <ShieldCheck size={25} />
            </div>
            <p className="mt-3 text-lg font-bold text-slate-900">SecureFDR</p>
          </div>
          <div><h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2><p className="mt-1 text-sm text-slate-500">Access your SecureFDR account</p></div>
          <label className="input input-bordered flex items-center gap-2"><Mail size={16} className="text-slate-400" />
            <input type="email" className="grow" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="input input-bordered flex items-center gap-2"><Lock size={16} className="text-slate-400" />
            <input type="password" className="grow" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? <span className="loading loading-spinner" /> : 'Sign in'}</button>
          <div className="divider text-[10px] font-semibold tracking-[0.12em] text-slate-400">DEMO ACCOUNTS · PASSWORD: DEMO123</div>
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
