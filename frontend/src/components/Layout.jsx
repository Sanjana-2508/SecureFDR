import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, ScrollText, Users, LogOut, Menu, ShieldCheck } from 'lucide-react'
import { useAuth } from '../AuthContext'

const MENU = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['INSTITUTION', 'OFFICER', 'ADMIN'] },
  { to: '/fdrs', label: 'FDR Records', icon: FileText, roles: ['INSTITUTION', 'OFFICER', 'ADMIN'] },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['OFFICER', 'ADMIN'] },
  { to: '/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
]
const ROLE_LABEL = { INSTITUTION: 'Institution', OFFICER: 'AICTE Officer', ADMIN: 'Administrator' }

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const items = MENU.filter((m) => m.roles.includes(user.role))

  return (
    <div className="drawer lg:drawer-open">
      <input id="drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col min-h-screen">
        <header className="navbar bg-base-100 shadow-sm sticky top-0 z-20 px-4">
          <label htmlFor="drawer" className="btn btn-ghost btn-square lg:hidden"><Menu size={20} /></label>
          <div className="flex-1 px-2 text-sm text-slate-500">{user.institution_name || 'All Institutions'}</div>
          <div className="flex items-center gap-3">
            <span className="badge badge-warning badge-outline hidden sm:inline-flex">Demo / sample data</span>
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</div>
            </div>
            <div className="avatar placeholder"><div className="bg-primary text-primary-content rounded-full w-9"><span>{user.name[0]}</span></div></div>
          </div>
        </header>
        <main className="p-4 md:p-6 flex-1"><Outlet /></main>
      </div>
      <div className="drawer-side z-30">
        <label htmlFor="drawer" className="drawer-overlay" />
        <aside className="bg-neutral text-slate-200 w-64 min-h-full flex flex-col">
          <div className="p-5 flex items-center gap-2 border-b border-slate-700">
            <ShieldCheck className="text-sky-400" size={28} />
            <div><div className="text-lg font-bold text-white leading-none">SecureFDR</div><div className="text-[11px] text-slate-400">AICTE Deposit Portal</div></div>
          </div>
          <ul className="menu p-3 gap-1 flex-1">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active !bg-primary !text-white' : 'hover:bg-slate-700')}>
                  <Icon size={18} />{label}
                </NavLink>
              </li>
            ))}
          </ul>
          <button className="m-3 btn btn-ghost justify-start text-slate-300 hover:bg-slate-700" onClick={() => { logout(); nav('/login') }}>
            <LogOut size={18} /> Sign out
          </button>
        </aside>
      </div>
    </div>
  )
}
