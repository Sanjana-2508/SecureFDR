import { useEffect, useState } from 'react'
import { Wallet, FileStack, CalendarClock, AlertTriangle } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../api'
import { useAuth } from '../AuthContext'
import StatusBadge from '../components/StatusBadge'
import { inr, fmtDate, STATUS_COLORS } from '../utils'

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="card dashboard-metric bg-white">
      <div className="card-body flex-col items-start gap-3 p-4 2xl:p-5">
        <div className={`dashboard-metric-icon ${color}`}>
          <Icon size={21} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="dashboard-metric-value text-xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
          <div className="mt-1 min-h-10 text-xs font-medium leading-5 text-slate-500 sm:text-sm">
            {label}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [fdrs, setFdrs] = useState(null)
  useEffect(() => { api.get('/fdrs').then((r) => setFdrs(r.data)) }, [])

  if (!fdrs) return <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary" /></div>

  const todayDate = new Date().toISOString().slice(0, 10)
  const [todayYear, todayMonth, todayDay] = todayDate.split('-').map(Number)
  const today = Date.UTC(todayYear, todayMonth - 1, todayDay)
  const daysUntilMaturity = (f) => {
    const [year, month, day] = f.maturity_date.split('-').map(Number)
    return (Date.UTC(year, month - 1, day) - today) / 86400000
  }
  const active = fdrs.filter((f) => !['RELEASED', 'RENEWED'].includes(f.status))
  const upcoming = active.filter((f) => {
    const days = daysUntilMaturity(f)
    return f.status !== 'MATURED' && days >= 0 && days <= 60
  })
  const overdue = active.filter((f) => daysUntilMaturity(f) < 0)
  const matured = active.filter(
    (f) => f.status === 'MATURED' || daysUntilMaturity(f) < 0
  )
  const maturedIds = new Set(matured.map((f) => f.id))
  const expiring = [...upcoming, ...overdue].sort((a, b) => daysUntilMaturity(a) - daysUntilMaturity(b))
  const attention = fdrs.filter((f) => ['SUBMITTED', 'UNDER_REVIEW', 'DISCREPANCY'].includes(f.status))
  const statusChart = Object.keys(STATUS_COLORS).map((status) => ({
    name: status.replaceAll('_', ' '),
    key: status,
    value: status === 'MATURED'
      ? matured.length
      : fdrs.filter(
          (f) => f.status === status && !maturedIds.has(f.id)
        ).length,
  })).filter((item) => item.value > 0)
  const maturityChart = [
    { name: 'Upcoming (60 days)', value: upcoming.length, color: '#d97706' },
    { name: 'Overdue', value: overdue.length, color: '#dc2626' },
  ]
  const isInst = user.role === 'INSTITUTION'

  return (
    <div className="space-y-6">
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Portfolio overview
          </p>
          <h1 className="page-title text-2xl font-bold">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="page-subtitle mt-1 text-sm">
            {isInst ? 'Overview of your institution’s FDRs' : 'Consolidated view of the institution-wise FDR portfolio'}
          </p>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Portfolio data
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat icon={FileStack} label={isInst ? 'My FDRs' : 'Total FDRs'} value={fdrs.length} color="bg-blue-100 text-blue-700" />
        <Stat icon={Wallet} label="Total deposit value" value={inr(fdrs.reduce((s, f) => s + f.amount, 0))} color="bg-emerald-100 text-emerald-700" />
        <Stat icon={CalendarClock} label="Maturing within 60 days" value={upcoming.length} color="bg-amber-100 text-amber-700" />
        <Stat icon={CalendarClock} label="Overdue FDRs" value={overdue.length} color="bg-red-100 text-red-700" />
        <Stat icon={AlertTriangle} label={isInst ? 'Awaiting verification / action' : 'Pending verification'} value={attention.length} color="bg-red-100 text-red-700" />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-5">
        <div className="card dashboard-chart-card min-w-0 bg-white xl:col-span-2"><div className="card-body p-5 md:p-6">
          <div className="mb-1">
            <h2 className="card-title text-base">FDR status distribution</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Matured combines formally matured FDRs and active records past their maturity date. Other slices show stored workflow status.</p>
          </div>
          {statusChart.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-400">No FDR records to display.</div>
          ) : (
            <div className="dashboard-status-chart h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusChart}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="43%"
                    innerRadius="52%"
                    outerRadius="68%"
                    paddingAngle={2}
                  >
                    {statusChart.map((item) => (
                      <Cell key={item.key} fill={STATUS_COLORS[item.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgb(15 23 42 / 10%)' }}
                    formatter={(value, name) => [value, name]}
                  />
                  <Legend
                    className="dashboard-status-legend"
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    height={56}
                    wrapperStyle={{ fontSize: 10, lineHeight: '18px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div></div>

        <div className="card dashboard-chart-card min-w-0 bg-white xl:col-span-3"><div className="card-body p-5 md:p-6">
          <div className="mb-1">
            <h2 className="card-title text-base">Maturity overview</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Date-derived counts for active FDRs; renewed and released records are excluded.</p>
          </div>
          {active.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-400">No active FDRs to assess for maturity.</div>
          ) : upcoming.length === 0 && overdue.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center text-center">
              <p className="font-medium text-slate-600">No upcoming or overdue maturities.</p>
              <p className="mt-1 text-sm text-slate-400">Active FDRs are outside the 60-day maturity window.</p>
            </div>
          ) : (
            <div className="dashboard-maturity-chart h-72">
              <ResponsiveContainer>
                <BarChart data={maturityChart} margin={{ left: 4, right: 16, top: 24, bottom: 12 }} barCategoryGap="30%">
                  <XAxis dataKey="name" interval={0} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} domain={[0, (max) => Math.max(max, 1)]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f3f6fb' }}
                    contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgb(15 23 42 / 10%)' }}
                    formatter={(value, _name, item) => [value, item.payload.name]}
                  />
                  <Bar dataKey="value" name="FDRs" radius={[5, 5, 0, 0]} maxBarSize={64}>
                    {maturityChart.map((item) => <Cell key={item.name} fill={item.color} />)}
                    <LabelList dataKey="value" position="top" fill="#475569" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div></div>
      </div>

      <div className="card bg-white"><div className="card-body p-5 md:p-6">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="card-title text-base">Maturity watch</h2>
              <p className="mt-1 text-xs text-slate-500">Upcoming from today through day 60, plus overdue FDRs</p>
            </div>
            <span className="badge border-0 bg-amber-50 text-amber-800">{expiring.length} records</span>
          </div>
          {expiring.length === 0 ? <div className="text-center text-slate-400 py-12">Nothing upcoming or overdue.</div> : (
            <div className="overflow-x-auto"><table className="table table-sm">
              <thead><tr><th>FDR</th>{!isInst && <th>Institution</th>}<th>Amount</th><th>Matures</th><th>Status</th></tr></thead>
              <tbody>{expiring.map((f) => { const d = daysUntilMaturity(f); return (
                <tr key={f.id}><td className="font-medium">{f.reference_no}<div className="text-xs text-slate-400">{f.bank_name}</div></td>
                  {!isInst && <td className="text-xs">{f.institution}</td>}
                  <td>{inr(f.amount)}</td>
                  <td>{fmtDate(f.maturity_date)}<div className={`text-xs font-semibold ${d < 0 ? 'text-error' : d <= 30 ? 'text-warning' : 'text-slate-400'}`}>{d < 0 ? `${-d} days overdue` : d === 0 ? 'Matures today' : `in ${d} days`}</div></td>
                  <td><StatusBadge status={f.status} /></td></tr>) })}</tbody>
            </table></div>)}
        </div>
      </div>
    </div>
  )
}
