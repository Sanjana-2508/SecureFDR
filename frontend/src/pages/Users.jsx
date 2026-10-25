import { useEffect, useState } from 'react'
import api from '../api'

const COLOR = { ADMIN: 'badge-accent', OFFICER: 'badge-primary', INSTITUTION: 'badge-secondary' }
export default function Users() {
  const [rows, setRows] = useState(null)
  useEffect(() => { api.get('/admin/users').then((r) => setRows(r.data)) }, [])
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">User Accounts</h1>
      <div className="card bg-base-100 shadow-sm overflow-x-auto">
        {!rows ? <div className="flex justify-center py-16"><span className="loading loading-spinner text-primary" /></div> : (
          <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Institution</th><th>Status</th></tr></thead>
            <tbody>{rows.map((u) => (<tr key={u.id}><td className="font-medium">{u.name}</td><td>{u.email}</td>
              <td><span className={`badge badge-sm ${COLOR[u.role]}`}>{u.role}</span></td><td>{u.institution || '—'}</td>
              <td><span className={`badge badge-sm ${u.is_active ? 'badge-success' : 'badge-ghost'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td></tr>))}</tbody></table>)}
      </div>
    </div>
  )
}
