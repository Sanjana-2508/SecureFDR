import { useEffect, useState } from 'react'
import {
  CheckCircle,
  ClipboardList,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react'
import api, { errMsg } from '../api'
import { useAuth } from '../AuthContext'
import StatusBadge from '../components/StatusBadge'
import { inr, fmtDate } from '../utils'

const initialForm = { fdr_id: '', reason: '' }

const ACTIONS = [
  { value: 'REVIEW', label: 'Start review' },
  { value: 'OBSERVATION', label: 'Raise observation' },
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
]

export default function Releases() {
  const { user } = useAuth()
  const isInstitution = user?.role === 'INSTITUTION'
  const isOfficer = ['OFFICER', 'ADMIN'].includes(user?.role)

  const [requests, setRequests] = useState([])
  const [fdrs, setFdrs] = useState([])
  const [form, setForm] = useState(initialForm)
  const [remarks, setRemarks] = useState({})
  const [resubmitReasons, setResubmitReasons] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workingId, setWorkingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const jobs = [api.get('/release-requests')]
      if (isInstitution) jobs.push(api.get('/fdrs'))

      const results = await Promise.all(jobs)
      setRequests(Array.isArray(results[0].data) ? results[0].data : [])

      if (isInstitution) {
        setFdrs(Array.isArray(results[1].data) ? results[1].data : [])
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const eligibleFdrs = fdrs.filter((f) => f.status === 'VERIFIED')

  async function createRequest(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      await api.post('/release-requests', {
        fdr_id: Number(form.fdr_id),
        reason: form.reason.trim(),
      })
      setForm(initialForm)
      setSuccess('Release request submitted successfully.')
      await loadData()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  async function decide(id, action) {
    const remark = (remarks[id] || '').trim()

    if (remark.length < 3) {
      setError('Enter at least 3 characters in the officer remarks.')
      return
    }

    if (
      !window.confirm(
        `Are you sure you want to ${action.toLowerCase()} this release request?`
      )
    ) {
      return
    }

    setWorkingId(id)
    setError('')
    setSuccess('')

    try {
      await api.post(`/release-requests/${id}/decision`, {
        action,
        remarks: remark,
      })
      setSuccess(`Request #${id}: ${action.toLowerCase()} completed.`)
      setRemarks((old) => ({ ...old, [id]: '' }))
      await loadData()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setWorkingId(null)
    }
  }

  async function resubmit(request) {
    const reason = (resubmitReasons[request.id] || '').trim()

    if (reason.length < 5) {
      setError('Enter at least 5 characters for the revised reason.')
      return
    }

    setWorkingId(request.id)
    setError('')
    setSuccess('')

    try {
      await api.post(`/release-requests/${request.id}/resubmit`, {
        fdr_id: request.fdr_id,
        reason,
      })
      setSuccess(`Release request #${request.id} resubmitted.`)
      setResubmitReasons((old) => ({ ...old, [request.id]: '' }))
      await loadData()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setWorkingId(null)
    }
  }

  async function recordRelease(request) {
    if (
      !window.confirm(
        'Record this approved FDR as released? This updates the workflow; it does not transfer money.'
      )
    ) {
      return
    }

    setWorkingId(request.id)
    setError('')
    setSuccess('')

    try {
      const { data } = await api.post(
        `/release-requests/${request.id}/record-release`
      )
      setSuccess(data.message || 'Release recorded.')
      await loadData()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Deposit lifecycle
          </p>
          <h1 className="page-title text-2xl font-bold">Release Management</h1>
          <p className="page-subtitle mt-1 text-sm">
            Submit, review, and track security deposit release requests.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm border-slate-300 bg-white text-slate-700 hover:border-primary hover:bg-blue-50 hover:text-primary"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {isInstitution && (
        <div className="card bg-white">
          <div className="card-body">
            <h2 className="card-title text-base">
              <Send size={20} />
              Request FDR release
            </h2>
            <p className="text-sm text-slate-500">
              Submit a request for review. A matured FDR is not released until its release workflow is approved and recorded.
            </p>

            {eligibleFdrs.length === 0 ? (
              <p className="text-sm opacity-70">
                No verified FDRs are available for a release request.
              </p>
            ) : (
              <form onSubmit={createRequest} className="space-y-4">
                <label className="form-control">
                  <span className="label-text mb-1">Verified FDR</span>
                  <select
                    className="select select-bordered"
                    required
                    value={form.fdr_id}
                    onChange={(e) =>
                      setForm({ ...form, fdr_id: e.target.value })
                    }
                  >
                    <option value="">Select an FDR</option>
                    {eligibleFdrs.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.fdr_uid || `FDR-${f.id}`} — {f.bank_name} —{' '}
                        {inr(f.amount)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Reason for release</span>
                  <textarea
                    className="textarea textarea-bordered"
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={3}
                    placeholder="Explain why the security deposit release is requested."
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </label>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={saving || !form.fdr_id}
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  Submit release request
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="card bg-white">
        <div className="card-body">
          <h2 className="card-title text-base">
            <ClipboardList size={20} />
            Release requests
            <span className="badge">{requests.length}</span>
          </h2>

          {loading ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : requests.length === 0 ? (
            <p className="py-8 text-center text-sm opacity-60">
              No release requests found.
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <article
                  key={request.id}
                  className="workflow-item space-y-4 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        Release request #{request.id}
                      </h3>
                      <p className="text-sm opacity-70">
                        {request.fdr_uid || `FDR-${request.fdr_id}`} ·{' '}
                        {request.bank_name || 'Bank not available'}
                      </p>
                      {isOfficer && request.institution && (
                        <p className="text-sm opacity-70">
                          Institution: {request.institution}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={request.status} />
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="opacity-60">Deposit amount</p>
                      <p className="font-medium">
                        {request.amount == null ? '—' : inr(request.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="opacity-60">Submitted by</p>
                      <p className="font-medium">
                        {request.requested_by || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="opacity-60">Submitted on</p>
                      <p>{fmtDate(request.created_at)}</p>
                    </div>
                    <div>
                      <p className="opacity-60">Reason</p>
                      <p className="whitespace-pre-wrap">{request.reason}</p>
                    </div>
                  </div>

                  {request.officer_remarks && (
                    <div className="rounded-lg bg-base-200 p-3 text-sm">
                      <p className="font-semibold">Officer remarks</p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {request.officer_remarks}
                      </p>
                    </div>
                  )}

                  {isOfficer &&
                    [
                      'SUBMITTED',
                      'UNDER_REVIEW',
                      'OBSERVATION_RAISED',
                      'RESUBMITTED',
                    ].includes(request.status) && (
                      <div className="space-y-3 border-t pt-4">
                        <label className="form-control">
                          <span className="label-text mb-1">
                            Officer remarks
                          </span>
                          <textarea
                            className="textarea textarea-bordered"
                            rows={2}
                            minLength={3}
                            maxLength={1000}
                            value={remarks[request.id] || ''}
                            onChange={(e) =>
                              setRemarks((old) => ({
                                ...old,
                                [request.id]: e.target.value,
                              }))
                            }
                            placeholder="Enter review remarks or decision reason."
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          {ACTIONS.map((action) => (
                            <button
                              key={action.value}
                              type="button"
                              className={`btn btn-sm ${
                                action.value === 'APPROVE'
                                  ? 'btn-success'
                                  : action.value === 'REJECT'
                                    ? 'btn-error btn-outline'
                                    : 'btn-outline'
                              }`}
                              disabled={workingId === request.id}
                              onClick={() =>
                                decide(request.id, action.value)
                              }
                            >
                              {action.value === 'APPROVE' ? (
                                <CheckCircle size={15} />
                              ) : action.value === 'REJECT' ? (
                                <XCircle size={15} />
                              ) : null}
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {isInstitution &&
                    request.status === 'OBSERVATION_RAISED' && (
                      <div className="space-y-3 border-t pt-4">
                        <label className="form-control">
                          <span className="label-text mb-1">
                            Revised release reason
                          </span>
                          <textarea
                            className="textarea textarea-bordered"
                            rows={2}
                            minLength={5}
                            maxLength={1000}
                            value={resubmitReasons[request.id] || ''}
                            onChange={(e) =>
                              setResubmitReasons((old) => ({
                                ...old,
                                [request.id]: e.target.value,
                              }))
                            }
                            placeholder="Address the officer's observation."
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={workingId === request.id}
                          onClick={() => resubmit(request)}
                        >
                          <Send size={15} />
                          Resubmit request
                        </button>
                      </div>
                    )}

                  {isOfficer && request.status === 'APPROVED' && (
                    <div className="border-t pt-4">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        disabled={workingId === request.id}
                        onClick={() => recordRelease(request)}
                      >
                        <CheckCircle size={16} />
                        Record release
                      </button>
                      <p className="mt-2 text-xs opacity-60">
                        Records the release in SecureFDR; it does not transfer
                        funds.
                      </p>
                    </div>
                  )}

                  {workingId === request.id && (
                    <p className="flex items-center gap-2 text-sm opacity-70">
                      <Loader2 size={15} className="animate-spin" />
                      Processing request…
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}