import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import api, { errMsg } from '../api'
import { useAuth } from '../AuthContext'
import StatusBadge from '../components/StatusBadge'
import { inr, fmtDate } from '../utils'

const initialForm = {
  bank_name: '',
  reference_no: '',
  amount: '',
  issue_date: '',
  maturity_date: '',
}

export default function Renewals() {
  const { user } = useAuth()
  const [fdrs, setFdrs] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [result, setResult] = useState(null)

  async function loadFdrs() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/fdrs')
      setFdrs(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFdrs()
  }, [])

  const eligible = fdrs.filter(
    (f) => ['VERIFIED', 'MATURED'].includes(f.status)
  )

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setResult(null)

    if (!selectedId) {
      setError('Select the original FDR first.')
      return
    }

    if (new Date(form.maturity_date) <= new Date(form.issue_date)) {
      setError('Maturity date must be after the issue date.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        bank_name: form.bank_name.trim(),
        reference_no: form.reference_no.trim(),
        amount: Number(form.amount),
        issue_date: form.issue_date,
        maturity_date: form.maturity_date,
      }

      const { data } = await api.post(
        `/fdrs/${selectedId}/renew`,
        payload
      )

      setResult(data)
      setSuccess(data.message || 'Renewal submitted successfully.')
      setForm(initialForm)
      setSelectedId('')
      await loadFdrs()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'INSTITUTION') {
    return (
      <div className="alert alert-warning">
        Only institution users can submit FDR renewals.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Deposit lifecycle
        </p>
        <h1 className="page-title text-2xl font-bold">Renewal & Replacement</h1>
        <p className="page-subtitle mt-1 text-sm">
          Submit a replacement FDR linked to an existing verified or matured
          deposit.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
        </div>
      )}

      {result && (
        <div className="card border border-success bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Renewal submitted</h2>
            <p>
              Original FDR:{' '}
              <strong>
                {result.original_fdr?.fdr_uid ||
                  `FDR-${result.original_fdr?.id}`}
              </strong>
            </p>
            <p>
              Replacement FDR:{' '}
              <strong>
                {result.renewed_fdr?.fdr_uid ||
                  `FDR-${result.renewed_fdr?.id}`}
              </strong>
            </p>
            <p>
              Status:{' '}
              <StatusBadge status={result.renewed_fdr?.status || 'SUBMITTED'} />
            </p>
            <p className="text-sm opacity-70">
              The replacement must still be verified by an officer. This
              records the workflow in SecureFDR; it does not renew the deposit
              with the bank.
            </p>
          </div>
        </div>
      )}

      <div className="card bg-white">
        <div className="card-body">
          <h2 className="card-title text-base">
            <RefreshCw size={20} />
            Submit replacement FDR
          </h2>
          <p className="text-sm text-slate-500">
            Link the new deposit to an eligible verified or matured FDR. The new record remains subject to officer verification.
          </p>

          {loading ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : eligible.length === 0 ? (
            <div className="alert">
              No verified or matured FDRs are currently eligible for renewal.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="form-control">
                <span className="label-text mb-1">Original FDR</span>
                <select
                  className="select select-bordered"
                  required
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="">Select an FDR</option>
                  {eligible.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fdr_uid || `FDR-${f.id}`} — {f.bank_name} —{' '}
                      {inr(f.amount)} — {f.status}
                    </option>
                  ))}
                </select>
              </label>

              {selectedId && (
                <div className="workflow-item rounded-xl border p-4 text-sm">
                  {(() => {
                    const f = eligible.find(
                      (item) => String(item.id) === String(selectedId)
                    )
                    if (!f) return null
                    return (
                      <>
                        <p>
                          <strong>Reference:</strong> {f.reference_no}
                        </p>
                        <p>
                          <strong>Maturity:</strong>{' '}
                          {fmtDate(f.maturity_date)}
                        </p>
                      </>
                    )
                  })()}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1">New bank name</span>
                  <input
                    className="input input-bordered"
                    required
                    minLength={2}
                    maxLength={150}
                    value={form.bank_name}
                    onChange={(e) =>
                      setForm({ ...form, bank_name: e.target.value })
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">
                    New FDR reference number
                  </span>
                  <input
                    className="input input-bordered"
                    required
                    minLength={2}
                    maxLength={100}
                    value={form.reference_no}
                    onChange={(e) =>
                      setForm({ ...form, reference_no: e.target.value })
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Amount (₹)</span>
                  <input
                    className="input input-bordered"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Issue date</span>
                  <input
                    className="input input-bordered"
                    type="date"
                    required
                    value={form.issue_date}
                    onChange={(e) =>
                      setForm({ ...form, issue_date: e.target.value })
                    }
                  />
                </label>

                <label className="form-control sm:col-span-2">
                  <span className="label-text mb-1">Maturity date</span>
                  <input
                    className="input input-bordered"
                    type="date"
                    required
                    min={form.issue_date || undefined}
                    value={form.maturity_date}
                    onChange={(e) =>
                      setForm({ ...form, maturity_date: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="alert alert-info text-sm">
                The original record will be marked as RENEWED when you submit.
                The new record will be created as SUBMITTED and needs officer
                verification.
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || !selectedId}
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}
                Submit renewal
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}