import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  ScrollText,
  Users,
  LogOut,
  Menu,
  ShieldCheck,
  RefreshCw,
  ClipboardList,
  Bell,
} from 'lucide-react'
import { useAuth } from '../AuthContext'

const MENU = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['INSTITUTION', 'OFFICER', 'ADMIN'],
  },
  {
    to: '/fdrs',
    label: 'FDR Records',
    icon: FileText,
    roles: ['INSTITUTION', 'OFFICER', 'ADMIN'],
  },
  {
    to: '/renewals',
    label: 'Renewal & Replacement',
    icon: RefreshCw,
    roles: ['INSTITUTION'],
  },
  {
    to: '/releases',
    label: 'Release Management',
    icon: ClipboardList,
    roles: ['INSTITUTION', 'OFFICER', 'ADMIN'],
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: Bell,
    roles: ['INSTITUTION', 'OFFICER', 'ADMIN'],
  },
  {
    to: '/audit',
    label: 'Audit Log',
    icon: ScrollText,
    roles: ['OFFICER', 'ADMIN'],
  },
  {
    to: '/users',
    label: 'Users',
    icon: Users,
    roles: ['ADMIN'],
  },
]

const ROLE_LABEL = {
  INSTITUTION: 'Institution',
  OFFICER: 'AICTE Officer',
  ADMIN: 'Administrator',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  const items = MENU.filter((item) => item.roles.includes(user?.role))

  function signOut() {
    logout()
    nav('/login', { replace: true })
  }

  return (
    <div className="drawer lg:drawer-open">
      <input id="drawer" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex min-h-screen flex-col">
        <header className="navbar sticky top-0 z-20 bg-base-100 px-4 shadow-sm">
          <label
            htmlFor="drawer"
            className="btn btn-square btn-ghost lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </label>

          <div className="flex-1 px-2 text-sm text-slate-500">
            {user?.institution_name || 'All Institutions'}
          </div>

          <div className="flex items-center gap-3">
            <span className="badge badge-warning badge-outline hidden sm:inline-flex">
              Demo / sample data
            </span>

            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold">{user?.name}</div>
              <div className="text-xs text-slate-500">
                {ROLE_LABEL[user?.role] || user?.role}
              </div>
            </div>

            <div className="avatar placeholder">
              <div className="w-9 rounded-full bg-primary text-primary-content">
                <span>{user?.name?.[0]?.toUpperCase() || 'U'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>

        <footer className="border-t border-base-300 px-6 py-3 text-center text-xs opacity-60">
          SecureFDR · AICTE Security Deposit Management Portal · Prototype
        </footer>
      </div>

      <div className="drawer-side z-30">
        <label htmlFor="drawer" className="drawer-overlay" />

        <aside className="flex min-h-full w-64 flex-col bg-neutral text-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-700 p-5">
            <ShieldCheck className="text-sky-400" size={28} />

            <div>
              <div className="text-lg font-bold leading-none text-white">
                SecureFDR
              </div>
              <div className="text-[11px] text-slate-400">
                AICTE Deposit Portal
              </div>
            </div>
          </div>

          <ul className="menu flex-1 gap-1 p-3">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'active !bg-primary !text-white'
                      : 'hover:bg-slate-700'
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn-ghost m-3 justify-start text-slate-300 hover:bg-slate-700"
            onClick={signOut}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </aside>
      </div>
    </div>
  )
}