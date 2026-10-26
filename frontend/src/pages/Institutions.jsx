import { useEffect, useState } from 'react'
import { Building2, Plus, X } from 'lucide-react'
import api, { errMsg } from '../api'

const EMPTY_FORM = { name: '', code: '', city: '', state: '' }

export default function Institutions() {
  const [institutions, setInstitutions] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  async function loadInstitutions() {
    try {
      const { data } = await api.get('/admin/institutions')
      setInstitutions(data)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  useEffect(() => {
    loadInstitutions()
  }, [])

  async function registerInstitution(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.post('/admin/institutions', {
        ...form,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      setSuccess('Institution registered.')
      await loadInstitutions()
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
            <Building2 size={22} className="text-primary" />
            Institution Management
          </h1>
          <p className="page-subtitle mt-1 text-sm">
            Register institutions and review their directory details.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} />
          Register Institution
        </button>
      </div>

      {error && <div role="alert" className="alert alert-error">{error}</div>}
      {success && <div role="status" className="alert alert-success">{success}</div>}

      <div className="table-shell overflow-x-auto">
        {!institutions ? (
          <div className="flex justify-center py-16"><span className="loading loading-spinner text-primary" /></div>
        ) : institutions.length === 0 ? (
          <div className="py-12 text-center text-slate-500">No institutions are registered yet.</div>
        ) : (
          <table className="table">
            <thead><tr><th>Institution</th><th>Code</th><th>City</th><th>State</th></tr></thead>
            <tbody>
              {institutions.map((institution) => (
                <tr key={institution.id}>
                  <td className="font-medium">{institution.name}</td>
                  <td>{institution.code}</td>
                  <td>{institution.city || '—'}</td>
                  <td>{institution.state || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Register Institution</h2>
              <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowForm(false)} aria-label="Close form">
                <X size={18} />
              </button>
            </div>
            <form className="mt-5 space-y-4" onSubmit={registerInstitution}>
              <label className="form-control">
                <span className="label-text mb-1">Institution name</span>
                <input className="input input-bordered" required minLength={2} maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="form-control">
                <span className="label-text mb-1">Institution code</span>
                <input className="input input-bordered uppercase" required minLength={2} maxLength={50} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1">City (optional)</span>
                  <input className="input input-bordered" maxLength={100} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="label-text mb-1">State (optional)</span>
                  <input className="input input-bordered" maxLength={100} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </label>
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading loading-spinner" /> : 'Register'}
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
