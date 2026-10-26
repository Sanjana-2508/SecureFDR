import { useEffect, useState } from 'react'
import { Plus, Users as UsersIcon, X } from 'lucide-react'
import api, { errMsg } from '../api'
import { useAuth } from '../AuthContext'

const COLOR = { ADMIN: 'badge-accent', OFFICER: 'badge-primary', INSTITUTION: 'badge-secondary' }
export default function Users() {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [institutions, setInstitutions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'INSTITUTION',
    institution_id: '',
  })

  async function loadUsers() {
    try {
      const { data } = await api.get('/admin/users')
      setRows(data)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  useEffect(() => {
    loadUsers()
    api.get('/admin/institutions')
      .then((response) => setInstitutions(response.data))
      .catch((err) => setError(errMsg(err)))
  }, [])

  async function createUser(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await api.post('/admin/users', {
        ...form,
        institution_id: form.role === 'INSTITUTION'
          ? Number(form.institution_id)
          : null,
      })
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'INSTITUTION',
        institution_id: '',
      })
      setShowForm(false)
      setSuccess('User account created.')
      await loadUsers()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
        {user?.role === 'ADMIN' && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Add User
          </button>
        )}
      </div>
      {error && <div role="alert" className="alert alert-error">{error}</div>}
      {success && <div role="status" className="alert alert-success">{success}</div>}
      <div className="table-shell overflow-x-auto">
        {!rows ? <div className="flex justify-center py-16"><span className="loading loading-spinner text-primary" /></div> : (
          <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Institution</th><th>Status</th></tr></thead>
            <tbody>{rows.map((u) => (<tr key={u.id}><td className="font-medium">{u.name}</td><td>{u.email}</td>
              <td><span className={`badge badge-sm ${COLOR[u.role]}`}>{u.role}</span></td><td>{u.institution || '—'}</td>
              <td><span className={`badge badge-sm ${u.is_active ? 'badge-success' : 'badge-ghost'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td></tr>))}</tbody></table>)}
      </div>
      {showForm && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Add User</h2>
              <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowForm(false)} aria-label="Close form">
                <X size={18} />
              </button>
            </div>
            <form className="mt-5 space-y-4" onSubmit={createUser}>
              <label className="form-control">
                <span className="label-text mb-1">Full name</span>
                <input className="input input-bordered" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1">Email</span>
                <input type="email" className="input input-bordered" required maxLength={150} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1">Initial password</span>
                <input type="password" className="input input-bordered" required minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <span className="label-text-alt mt-1">At least 12 characters. Share it with the user through a secure channel.</span>
              </label>
              <label className="form-control">
                <span className="label-text mb-1">Role</span>
                <select className="select select-bordered" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, institution_id: '' })}>
                  <option value="INSTITUTION">Institution</option>
                  <option value="OFFICER">Officer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              {form.role === 'INSTITUTION' && (
                <label className="form-control">
                  <span className="label-text mb-1">Institution</span>
                  <select className="select select-bordered" required value={form.institution_id} onChange={(e) => setForm({ ...form, institution_id: e.target.value })}>
                    <option value="" disabled>Select institution</option>
                    {institutions.map((institution) => (
                      <option key={institution.id} value={institution.id}>{institution.name} ({institution.code})</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || (form.role === 'INSTITUTION' && institutions.length === 0)}>
                  {saving ? <span className="loading loading-spinner" /> : 'Create account'}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setShowForm(false)}>close</button></form>
        </dialog>
      )}
    </div>
  )
}
