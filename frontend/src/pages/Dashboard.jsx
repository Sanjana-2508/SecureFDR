import { useEffect, useState } from 'react'
import { Wallet, FileStack, CalendarClock, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../api'
import { useAuth } from '../AuthContext'
import StatusBadge from '../components/StatusBadge'
import { inr, fmtDate, STATUS_COLORS } from '../utils'

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-5 flex-row items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}><Icon size={22} /></div>
        <div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-slate-500">{label}</div></div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [fdrs, setFdrs] = useState(null)
  useEffect(() => { api.get('/fdrs').then((r) => setFdrs(r.data)) }, [])

  if (!fdrs) return <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary" /></div>

  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const daysUntilMaturity = (f) => {
    const [year, month, day] = f.maturity_date.split('-').map(Number)
    return (Date.UTC(year, month - 1, day) - today) / 86400000
  }
  const active = fdrs.filter((f) => !['RELEASED', 'RENEWED'].includes(f.status))
  const upcoming = active.filter((f) => {
    const days = daysUntilMaturity(f)
    return days >= 0 && days <= 60
  })
  const overdue = active.filter((f) => daysUntilMaturity(f) < 0)
  const matured = active.filter(
    (f) => f.status === 'MATURED' || daysUntilMaturity(f) < 0
  )
  const maturedIds = new Set(matured.map((f) => f.id))
  const expiring = active.filter((f) => daysUntilMaturity(f) <= 60).sort((a, b) => daysUntilMaturity(a) - daysUntilMaturity(b))
  const attention = fdrs.filter((f) => ['SUBMITTED', 'UNDER_REVIEW', 'DISCREPANCY'].includes(f.status))
  const chart = [
    ...Object.keys(STATUS_COLORS).map((s) => ({
      status: s.replace('_', ' '),
      key: s,
      count: s === 'MATURED'
        ? matured.length
        : fdrs.filter(
            (f) => f.status === s && !maturedIds.has(f.id)
          ).length,
    })),
    { status: 'Upcoming (60d)', key: 'UPCOMING', count: upcoming.length, color: '#f59e0b' },
    { status: 'Overdue (date)', key: 'OVERDUE', count: overdue.length, color: '#dc2626' },
  ]
  const isInst = user.role === 'INSTITUTION'

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Welcome back, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-slate-500 text-sm">{isInst ? 'Overview of your institution’s FDRs' : 'Consolidated view of the institution-wise FDR portfolio'}</p></div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={FileStack} label={isInst ? 'My FDRs' : 'Total FDRs'} value={fdrs.length} color="bg-blue-100 text-blue-700" />
        <Stat icon={Wallet} label="Total deposit value" value={inr(fdrs.reduce((s, f) => s + f.amount, 0))} color="bg-emerald-100 text-emerald-700" />
        <Stat icon={CalendarClock} label="Maturing within 60 days" value={upcoming.length} color="bg-amber-100 text-amber-700" />
        <Stat icon={AlertTriangle} label={isInst ? 'Awaiting verification / action' : 'Pending verification'} value={attention.length} color="bg-red-100 text-red-700" />
      </div>

      <div className="grid xl:grid-cols-5 gap-4">
        <div className="card bg-base-100 shadow-sm xl:col-span-2"><div className="card-body">
          <h2 className="card-title text-base">FDRs by status and maturity</h2>
          <p className="text-xs text-slate-500">Matured includes active FDRs past their maturity date or formally marked MATURED. Overdue is the past-date subset; renewed and released FDRs are excluded.</p>
          <div className="h-64"><ResponsiveContainer>
            <BarChart data={chart} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="status" width={90} tick={{ fontSize: 11 }} />
              <Tooltip /><Bar dataKey="count" radius={4}>{chart.map((c) => <Cell key={c.key} fill={STATUS_COLORS[c.key] || c.color} />)}</Bar>
            </BarChart></ResponsiveContainer></div>
        </div></div>

        <div className="card bg-base-100 shadow-sm xl:col-span-3"><div className="card-body">
          <h2 className="card-title text-base">Expiring soon / overdue</h2>
          {expiring.length === 0 ? <div className="text-center text-slate-400 py-12">🎉 Nothing maturing in the next 60 days</div> : (
            <div className="overflow-x-auto"><table className="table table-sm">
              <thead><tr><th>FDR</th>{!isInst && <th>Institution</th>}<th>Amount</th><th>Matures</th><th>Status</th></tr></thead>
              <tbody>{expiring.map((f) => { const d = daysUntilMaturity(f); return (
                <tr key={f.id}><td className="font-medium">{f.reference_no}<div className="text-xs text-slate-400">{f.bank_name}</div></td>
                  {!isInst && <td className="text-xs">{f.institution}</td>}
                  <td>{inr(f.amount)}</td>
                  <td>{fmtDate(f.maturity_date)}<div className={`text-xs font-semibold ${d < 0 ? 'text-error' : d <= 30 ? 'text-warning' : 'text-slate-400'}`}>{d < 0 ? `${-d} days overdue` : `in ${d} days`}</div></td>
                  <td><StatusBadge status={f.status} /></td></tr>) })}</tbody>
            </table></div>)}
        </div></div>
      </div>
    </div>
  )
}
