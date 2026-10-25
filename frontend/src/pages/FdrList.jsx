import { useEffect, useState } from 'react'
import {
  Search,
  Eye,
  Plus,
  X,
  Loader2,
  Upload,
  Download,
  FileText,
} from 'lucide-react'
import api, { errMsg } from '../api'
import { useAuth } from '../AuthContext'
import StatusBadge from '../components/StatusBadge'
import { inr, fmtDate, daysLeft, STATUS_COLORS } from '../utils'

const today = new Date().toISOString().slice(0, 10)
const nextYear = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const initialForm = {
  bank_name: '',
  reference_no: '',
  amount: '',
  issue_date: today,
  maturity_date: nextYear(),
}

export default function FdrList() {
  const { user } = useAuth()

  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sel, setSel] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [documents, setDocuments] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  const isInst = user.role === 'INSTITUTION'

  const canUpload = user.role === 'INSTITUTION'

  async function loadDocuments(fdrId) {
    setLoadingDocs(true)
    setError('')

    try {
      const response = await api.get(`/fdrs/${fdrId}/documents`)
      setDocuments(response.data)
    } catch (e) {
      setDocuments([])
      setError(errMsg(e))
    } finally {
      setLoadingDocs(false)
    }
  }

  async function uploadDocument(e) {
    e.preventDefault()

    if (!sel || !selectedFile) {
      setError('Please select a PDF certificate.')
      return
    }

    if (selectedFile.type !== 'application/pdf' &&
        !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('The PDF must be 5 MB or smaller.')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const data = new FormData()
      data.append('file', selectedFile)
      data.append('doc_type', 'FDR_COPY')

      await api.post(`/fdrs/${sel.id}/documents`, data)

      setSelectedFile(null)
      e.target.reset()

      await loadDocuments(sel.id)
      setSuccess('FDR certificate uploaded successfully!')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setUploading(false)
    }
  }

  async function downloadDocument(document) {
    setError('')

    try {
      const response = await api.get(
        `/fdrs/${sel.id}/documents/${document.id}`,
        { responseType: 'blob' }
      )

      const url = URL.createObjectURL(response.data)
      const link = window.document.createElement('a')

      link.href = url
      link.download = document.filename || 'FDR-certificate.pdf'

      window.document.body.appendChild(link)
      link.click()
      link.remove()

      URL.revokeObjectURL(url)
    } catch (e) {
      setError('Unable to download the document. Please try again.')
    }
  }

  async function loadFdrs() {
    try {
      const response = await api.get('/fdrs', {
        params: {
          q: q || undefined,
          status: status || undefined,
        },
      })
      setRows(response.data)
    } catch (e) {
      setError(errMsg(e))
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFdrs()
    }, 250)

    return () => clearTimeout(timer)
  }, [q, status])

  useEffect(() => {
    if (sel?.id) {
      setDocuments([])
      setSelectedFile(null)
      loadDocuments(sel.id)
    }
  }, [sel?.id])

  function updateField(e) {
    const { name, value } = e.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  async function submitFdr(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.maturity_date <= form.issue_date) {
      setError('Maturity date must be after the issue date.')
      return
    }

    if (Number(form.amount) <= 0 || !Number.isFinite(Number(form.amount))) {
      setError('Enter a valid amount greater than zero.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
      }

      const response = await api.post('/fdrs', payload)

      setRows((previous) => {
        const current = previous || []
        const updated = [...current, response.data]
        return updated.sort(
          (a, b) => a.maturity_date.localeCompare(b.maturity_date)
        )
      })

      setQ('')
      setStatus('')
      setForm({
        ...initialForm,
        issue_date: today,
        maturity_date: nextYear(),
      })
      setShowForm(false)
      setSuccess(
        `FDR ${response.data.fdr_uid} submitted successfully!`
      )

      await loadFdrs()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {isInst ? 'My FDR Records' : 'FDR Records'}
        </h1>

        <div className="flex flex-wrap gap-2">
          <label className="input input-bordered input-sm flex items-center gap-2">
            <Search size={14} />
            <input
              className="grow"
              placeholder="Search bank / reference"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <select
            className="select select-bordered select-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.keys(STATUS_COLORS).map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </select>

          {isInst && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setError('')
                setSuccess('')
                setShowForm(true)
              }}
            >
              <Plus size={16} />
              Add FDR
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setSuccess('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showForm && isInst && (
        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Submit a New FDR</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => setShowForm(false)}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-base-content/60">
              Enter the FDR details for your institution. The record will
              be submitted for officer review.
            </p>

            <form onSubmit={submitFdr} className="space-y-4 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="form-control">
                  <span className="label-text mb-1">Bank name *</span>
                  <input
                    className="input input-bordered"
                    name="bank_name"
                    value={form.bank_name}
                    onChange={updateField}
                    placeholder="e.g. State Bank of India"
                    minLength={2}
                    maxLength={150}
                    required
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">
                    FDR reference number *
                  </span>
                  <input
                    className="input input-bordered"
                    name="reference_no"
                    value={form.reference_no}
                    onChange={updateField}
                    placeholder="e.g. SBI-FDR-7001"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">
                    Amount (₹) *
                  </span>
                  <input
                    className="input input-bordered"
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={updateField}
                    placeholder="500000"
                    min="0.01"
                    max="1000000000000"
                    step="0.01"
                    required
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Issue date *</span>
                  <input
                    className="input input-bordered"
                    type="date"
                    name="issue_date"
                    value={form.issue_date}
                    onChange={updateField}
                    required
                  />
                </label>

                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1">
                    Maturity date *
                  </span>
                  <input
                    className="input input-bordered"
                    type="date"
                    name="maturity_date"
                    value={form.maturity_date}
                    onChange={updateField}
                    min={form.issue_date}
                    required
                  />
                </label>
              </div>

              <div className="alert alert-info text-sm">
                The record will be marked SUBMITTED. Bank verification is
                not performed by this form.
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit FDR'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow-sm">
        <div className="overflow-x-auto">
          {!rows ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              No FDR records match your filters
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Reference / Bank</th>
                  {!isInst && <th>Institution</th>}
                  <th>Amount</th>
                  <th>Issue</th>
                  <th>Maturity</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} className="hover">
                    <td className="text-xs text-slate-500">
                      {f.fdr_uid}
                    </td>

                    <td className="font-medium">
                      {f.reference_no}
                      <div className="text-xs text-slate-400">
                        {f.bank_name}
                      </div>
                    </td>

                    {!isInst && <td className="text-sm">{f.institution}</td>}

                    <td>{inr(f.amount)}</td>
                    <td className="text-sm">{fmtDate(f.issue_date)}</td>
                    <td className="text-sm">{fmtDate(f.maturity_date)}</td>

                    <td>
                      <StatusBadge status={f.status} />
                    </td>

                    <td>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setSel(f)}
                        aria-label={`View ${f.reference_no}`}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {sel && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg flex items-center gap-2">
              {sel.reference_no}
              <StatusBadge status={sel.status} />
            </h3>

            <div className="grid grid-cols-2 gap-3 my-4 text-sm">
              {[
                ['FDR ID', sel.fdr_uid],
                ['Institution', sel.institution],
                ['Bank', sel.bank_name],
                ['Amount', inr(sel.amount)],
                ['Issue date', fmtDate(sel.issue_date)],
                ['Maturity date', fmtDate(sel.maturity_date)],
                ['Days to maturity', daysLeft(sel.maturity_date)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-slate-400">{k}</div>
                  <div className="font-medium">{v}</div>
                </div>
              ))}
            </div>

            <div className="alert alert-warning py-2 text-xs">
              Verification shown here is simulated sample data — no bank
              integration.
            </div>
            
            <div className="divider">FDR Documents</div>

              {canUpload && (
                <form onSubmit={uploadDocument} className="space-y-3">
                  <label className="form-control">
                    <span className="label-text mb-1">
                      Upload certificate (PDF, max 5 MB)
                    </span>

                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="file-input file-input-bordered w-full"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload Certificate
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="space-y-2 mt-4">
                <h4 className="font-semibold text-sm">Uploaded certificates</h4>

                {loadingDocs ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    Loading documents...
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-base-content/60">
                    No documents uploaded for this FDR yet.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={20} className="shrink-0" />

                        <div className="min-w-0">
                          <p className="text-sm font-medium break-all">
                            {doc.filename}
                          </p>
                          <p className="text-xs text-base-content/60">
                            {doc.doc_type} ·{' '}
                            {doc.uploaded_at
                              ? new Date(doc.uploaded_at).toLocaleString()
                              : 'Date unavailable'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-outline btn-sm shrink-0"
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download size={15} />
                        Download
                      </button>
                    </div>
                  ))
                )}
              </div>
            <div className="modal-action">
              <button
                className="btn btn-sm"
                onClick={() => setSel(null)}
              >
                Close
              </button>
            </div>
          </div>

          <div
            className="modal-backdrop"
            onClick={() => setSel(null)}
          />
        </dialog>
      )}
    </div>
  )
}