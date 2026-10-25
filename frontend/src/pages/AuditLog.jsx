import { useEffect, useState } from 'react'
import api from '../api'

export default function AuditLog() {
  const [rows, setRows] = useState(null)
  useEffect(() => { api.get('/admin/audit-logs').then((r) => setRows(r.data)) }, [])
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <div className="card bg-base-100 shadow-sm overflow-x-auto">
        {!rows ? <div className="flex justify-center py-16"><span className="loading loading-spinner text-primary" /></div>
          : rows.length === 0 ? <div className="text-center py-16 text-slate-400">No activity recorded yet</div> : (
          <table className="table table-sm"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>{rows.map((r) => (<tr key={r.id}>
              <td className="text-xs whitespace-nowrap">{new Date(r.created_at + 'Z').toLocaleString('en-IN')}</td>
              <td>{r.user}</td><td><span className="badge badge-outline badge-sm">{r.action}</span></td>
              <td className="text-xs">{r.entity} {r.entity_id ?? ''}</td><td className="text-xs text-slate-500">{r.details}</td></tr>))}</tbody></table>)}
      </div>
    </div>
  )
}
