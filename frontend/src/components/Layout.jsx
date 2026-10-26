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
  Building2,
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
  {
    to: '/institutions',
    label: 'Institutions',
    icon: Building2,
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
        <header className="navbar sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur md:px-6">
          <label
            htmlFor="drawer"
            className="btn btn-square btn-ghost text-slate-600 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </label>

          <div className="min-w-0 flex-1 px-2">
            <div className="truncate text-sm font-semibold text-slate-700">
              {user?.institution_name || 'All Institutions'}
            </div>
            <div className="hidden text-xs text-slate-400 sm:block">
              AICTE Security Deposit Management
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold">{user?.name}</div>
              <div className="mt-1 text-xs text-slate-500">
                {ROLE_LABEL[user?.role] || user?.role}
              </div>
            </div>

            <div className="avatar placeholder">
              <div className="w-9 rounded-full border border-blue-100 bg-blue-50 text-primary">
                <span>{user?.name?.[0]?.toUpperCase() || 'U'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-7 md:py-8 xl:px-10">
          <div className="app-content">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white/70 px-6 py-4 text-center text-xs text-slate-500">
          SecureFDR · AICTE Security Deposit Management Portal · Prototype
        </footer>
      </div>

      <div className="drawer-side z-30">
        <label htmlFor="drawer" className="drawer-overlay" />

        <aside className="flex min-h-full w-72 flex-col border-r border-slate-200 bg-white text-slate-700">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-primary">
              <ShieldCheck size={25} />
            </div>

            <div>
              <div className="text-lg font-bold leading-none tracking-tight text-slate-900">
                SecureFDR
              </div>
              <div className="mt-1 text-[11px] font-medium text-slate-500">
                AICTE Deposit Portal
              </div>
            </div>
          </div>

          <div className="px-5 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </div>
          <ul className="menu flex-1 gap-1 px-3 pb-4">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'active !bg-blue-50 !font-semibold !text-primary'
                      : 'text-slate-600 hover:!bg-slate-50 hover:!text-slate-900'
                  }
                >
                  <Icon size={18} strokeWidth={1.8} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn-ghost m-3 justify-start text-slate-600 hover:bg-red-50 hover:text-red-700"
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