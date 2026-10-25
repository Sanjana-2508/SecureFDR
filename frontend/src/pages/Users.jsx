import { useEffect, useState } from 'react'
import { Users as UsersIcon } from 'lucide-react'
import api from '../api'

const COLOR = { ADMIN: 'badge-accent', OFFICER: 'badge-primary', INSTITUTION: 'badge-secondary' }
export default function Users() {
  const [rows, setRows] = useState(null)
  useEffect(() => { api.get('/admin/users').then((r) => setRows(r.data)) }, [])
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Administration
        </p>
        <h1 className="page-title flex items-center gap-2 text-2xl font-bold">
          <UsersIcon size={22} className="text-primary" />
          User Accounts
        </h1>
        <p className="page-subtitle mt-1 text-sm">
          Review account access, roles, and institution assignments.
        </p>
      </div>
      <div className="table-shell overflow-x-auto">
        {!rows ? <div className="flex justify-center py-16"><span className="loading loading-spinner text-primary" /></div> : (
          <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Institution</th><th>Status</th></tr></thead>
            <tbody>{rows.map((u) => (<tr key={u.id}><td className="font-medium">{u.name}</td><td>{u.email}</td>
              <td><span className={`badge badge-sm ${COLOR[u.role]}`}>{u.role}</span></td><td>{u.institution || '—'}</td>
              <td><span className={`badge badge-sm ${u.is_active ? 'badge-success' : 'badge-ghost'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td></tr>))}</tbody></table>)}
      </div>
    </div>
  )
}
