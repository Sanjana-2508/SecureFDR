import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  Eye,
  Plus,
  X,
  Loader2,
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  ShieldCheck,
} from 'lucide-react'

import api, { errMsg } from '../api'
import { useAuth } from '../AuthContext'
import StatusBadge from '../components/StatusBadge'
import { inr, fmtDate } from '../utils'

export default function FdrList() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sel, setSel] = useState(null)

  const [form, setForm] = useState({
    bank_name: '',
    reference_no: '',
    amount: '',
    issue_date: '',
    maturity_date: '',
  })

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [documents, setDocuments] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [documentError, setDocumentError] = useState('')
  const [documentSuccess, setDocumentSuccess] = useState('')

  const [decisionRemarks, setDecisionRemarks] = useState('')
  const [decisionLoading, setDecisionLoading] = useState(false)

  const isInstitution = user?.role === 'INSTITUTION'
  const canUpload = isInstitution

  const canDecide = ['OFFICER', 'ADMIN'].includes(user?.role)

  // Load FDR records
  async function loadFdrs() {
    try {
      const params = {}

      if (q.trim()) params.q = q.trim()
      if (status) params.status = status

      const response = await api.get('/fdrs', { params })
      setRows(response.data)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  // Load documents attached to an FDR
  async function loadDocuments(fdrId) {
    if (!fdrId) return

    setDocumentError('')
    setDocumentSuccess('')

    try {
      const response = await api.get(`/fdrs/${fdrId}/documents`)
      setDocuments(response.data)
    } catch (err) {
      setDocuments([])
      setDocumentError(errMsg(err))
    }
  }

  // Upload PDF certificate
  async function uploadDocument(e) {
    e.preventDefault()

    if (!sel?.id) {
      setDocumentError('Select an FDR first.')
      return
    }

    if (!selectedFile) {
      setDocumentError('Please select a PDF certificate.')
      return
    }

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setDocumentError('Please select a PDF file.')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setDocumentError('The PDF must be 5 MB or smaller.')
      return
    }

    setUploading(true)
    setDocumentError('')
    setDocumentSuccess('')

    try {
      const body = new FormData()
      body.append('file', selectedFile)

      await api.post(`/fdrs/${sel.id}/documents`, body)

      setSelectedFile(null)
      setDocumentSuccess('Certificate uploaded successfully.')

      await loadDocuments(sel.id)

      const fileInput = document.getElementById('fdr-certificate-input')
      if (fileInput) fileInput.value = ''
    } catch (err) {
      setDocumentError(errMsg(err))
    } finally {
      setUploading(false)
    }
  }

  // Download a certificate
  async function downloadDocument(doc) {
    try {
      setDocumentError('');

      const response = await api.get(
        `/fdrs/${doc.fdr_id}/documents/${doc.id}`,
        {
          responseType: 'blob',
        }
      );

      const blob = new Blob([response.data], {
        type: 'application/pdf',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = doc.filename || 'fdr-certificate.pdf';

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setDocumentError(errMsg(err));
    }
  }

  // Submit a new FDR
  async function submitFdr(e) {
    e.preventDefault()

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        bank_name: form.bank_name.trim(),
        reference_no: form.reference_no.trim(),
        amount: Number(form.amount),
        issue_date: form.issue_date,
        maturity_date: form.maturity_date,
      }

      if (new Date(payload.maturity_date) <= new Date(payload.issue_date)) {
        setError('Maturity date must be after the issue date.')
        return
      }

      await api.post('/fdrs', payload)

      setSuccess('FDR submitted successfully.')
      setShowForm(false)

      setForm({
        bank_name: '',
        reference_no: '',
        amount: '',
        issue_date: '',
        maturity_date: '',
      })

      await loadFdrs()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  // Verify or flag an FDR for discrepancy
  async function decideFdr(action) {
    if (!sel?.id) return

    const remarks = decisionRemarks.trim()

    if (remarks.length < 3) {
      setDocumentError('Please enter at least 3 characters for the remarks.')
      return
    }

    const confirmed =
      action === 'verify'
        ? window.confirm('Are you sure you want to verify this FDR?')
        : window.confirm('Are you sure you want to flag this FDR for discrepancy?')

    if (!confirmed) return

    setDecisionLoading(true)
    setDocumentError('')
    setDocumentSuccess('')
    setSuccess('')

    try {
      await api.post(`/fdrs/${sel.id}/${action}`, {
        remarks,
      })

      setDecisionRemarks('')

      setDocumentSuccess(
        action === 'verify'
          ? 'FDR verified successfully. Verification is simulated.'
          : 'FDR flagged for discrepancy successfully.'
      )

      // Refresh the selected record and the list
      const response = await api.get(`/fdrs/${sel.id}`)
      setSel(response.data)

      await loadFdrs()
    } catch (err) {
      setDocumentError(errMsg(err))
    } finally {
      setDecisionLoading(false)
    }
  }

  // Fetch records when the page opens or filters change
  useEffect(() => {
    loadFdrs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status])

  useEffect(() => {
    const requestedId = Number(searchParams.get('fdrId'))
    if (!requestedId || rows.length === 0) return

    const requestedRecord = rows.find((record) => record.id === requestedId)
    if (requestedRecord) {
      setSel(requestedRecord)
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('fdrId')
        return next
      }, { replace: true })
    }
  }, [rows, searchParams, setSearchParams])

  // Fetch documents whenever a record is selected
  useEffect(() => {
    if (sel?.id) {
      loadDocuments(sel.id)
    } else {
      setDocuments([])
      setSelectedFile(null)
      setDecisionRemarks('')
      setDocumentError('')
      setDocumentSuccess('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id])

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title text-2xl font-bold">FDR Records</h1>
          <p className="page-subtitle mt-1 text-sm">
            Manage security deposits and fixed deposit receipts.
          </p>
        </div>

        {isInstitution && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setError('')
              setSuccess('')
              setShowForm(true)
            }}
          >
            <Plus size={18} />
            Submit FDR
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setError('')}
            aria-label="Dismiss error"
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
            aria-label="Dismiss success message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search and filters */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex flex-col gap-3 md:flex-row">
            <label className="input input-bordered flex flex-1 items-center gap-2">
              <Search size={18} className="opacity-60" />

              <input
                type="text"
                className="grow"
                placeholder="Search bank or reference number..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>

            <select
              className="select select-bordered w-full md:w-56"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="DISCREPANCY">Discrepancy</option>
              <option value="VERIFIED">Verified</option>
              <option value="MATURED">Matured</option>
              <option value="RENEWED">Renewed</option>
              <option value="RELEASED">Released</option>
            </select>
          </div>
        </div>
      </div>

      {/* FDR table */}
      <div className="table-shell overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>FDR ID</th>
              {!isInstitution && <th>Institution</th>}
              <th>Bank</th>
              <th>Reference No.</th>
              <th>Amount</th>
              <th>Issue Date</th>
              <th>Maturity Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((fdr) => (
              <tr key={fdr.id}>
                <td className="font-medium">
                  {fdr.fdr_uid || `FDR-${fdr.id}`}
                </td>

                {!isInstitution && (
                  <td>{fdr.institution || '—'}</td>
                )}

                <td>{fdr.bank_name}</td>
                <td>{fdr.reference_no}</td>

                <td>{inr(fdr.amount)}</td>
                <td>{fmtDate(fdr.issue_date)}</td>
                <td>{fmtDate(fdr.maturity_date)}</td>

                <td>
                  <StatusBadge status={fdr.status} />
                </td>

                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setSel(fdr)
                      setDocumentError('')
                      setDocumentSuccess('')
                    }}
                  >
                    <Eye size={16} />
                    View
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={isInstitution ? 8 : 9}
                  className="py-10 text-center opacity-60"
                >
                  No FDR records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Submit FDR modal */}
      {showForm && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Submit New FDR</h2>

              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitFdr} className="mt-5 space-y-4">
              <label className="form-control">
                <span className="label-text mb-1">Bank Name</span>
                <input
                  className="input input-bordered"
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.bank_name}
                  onChange={(e) =>
                    setForm({ ...form, bank_name: e.target.value })
                  }
                  placeholder="Enter bank name"
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1">FDR Reference Number</span>
                <input
                  className="input input-bordered"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.reference_no}
                  onChange={(e) =>
                    setForm({ ...form, reference_no: e.target.value })
                  }
                  placeholder="Enter reference number"
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-1">Amount (₹)</span>
                <input
                  type="number"
                  className="input input-bordered"
                  required
                  min="0.01"
                  max="1000000000000"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value })
                  }
                  placeholder="Enter amount"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1">Issue Date</span>
                  <input
                    type="date"
                    className="input input-bordered"
                    required
                    value={form.issue_date}
                    onChange={(e) =>
                      setForm({ ...form, issue_date: e.target.value })
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Maturity Date</span>
                  <input
                    type="date"
                    className="input input-bordered"
                    required
                    min={form.issue_date || undefined}
                    value={form.maturity_date}
                    onChange={(e) =>
                      setForm({ ...form, maturity_date: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="modal-action">
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
                  {saving && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  Submit FDR
                </button>
              </div>
            </form>
          </div>

          <div
            className="modal-backdrop"
            onClick={() => !saving && setShowForm(false)}
          />
        </dialog>
      )}

      {/* FDR details modal */}
      {sel && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {sel.fdr_uid || `FDR-${sel.id}`}
                </h2>

                <p className="text-sm opacity-70">
                  FDR details and document management
                </p>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setSel(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            {/* FDR information */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {!isInstitution && (
                <div>
                  <p className="text-sm opacity-60">Institution</p>
                  <p className="font-medium">{sel.institution || '—'}</p>
                </div>
              )}

              <div>
                <p className="text-sm opacity-60">Bank</p>
                <p className="font-medium">{sel.bank_name}</p>
              </div>

              <div>
                <p className="text-sm opacity-60">Reference Number</p>
                <p className="font-medium">{sel.reference_no}</p>
              </div>

              <div>
                <p className="text-sm opacity-60">Amount</p>
                <p className="font-medium">
                  {inr(sel.amount)}
                </p>
              </div>

              <div>
                <p className="text-sm opacity-60">Issue Date</p>
                <p className="font-medium">
                  {fmtDate(sel.issue_date)}
                </p>
              </div>

              <div>
                <p className="text-sm opacity-60">Maturity Date</p>
                <p className="font-medium">
                  {fmtDate(sel.maturity_date)}
                </p>
              </div>

              <div>
                <p className="text-sm opacity-60">Status</p>
                <StatusBadge status={sel.status} />
              </div>

              <div>
                <p className="text-sm opacity-60">Verification Type</p>
                <p className="font-medium">
                  {sel.is_simulated_verification
                    ? 'Simulated verification'
                    : 'Not specified'}
                </p>
              </div>

              {sel.verification_remarks && (
                <div className="sm:col-span-2">
                  <p className="text-sm opacity-60">
                    Verification Remarks
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {sel.verification_remarks}
                  </p>
                </div>
              )}
            </div>

            <div className="alert alert-warning mt-5 py-2 text-xs">
              Verification shown here is simulated sample data. No live bank
              verification is performed.
            </div>

            {/* Officer verification/rejection */}
            {canDecide &&
              ['SUBMITTED', 'UNDER_REVIEW'].includes(sel.status) && (
                <div className="mt-5 space-y-3 rounded-xl border p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck size={18} />
                    Officer Decision
                  </div>

                  <label className="form-control">
                    <span className="label-text mb-1">
                      Verification remarks / rejection reason
                    </span>

                    <textarea
                      className="textarea textarea-bordered w-full"
                      placeholder="Enter your review remarks..."
                      value={decisionRemarks}
                      onChange={(e) =>
                        setDecisionRemarks(e.target.value)
                      }
                      minLength={3}
                      maxLength={1000}
                      rows={3}
                      disabled={decisionLoading}
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      disabled={
                        decisionLoading ||
                        decisionRemarks.trim().length < 3
                      }
                      onClick={() => decideFdr('verify')}
                    >
                      {decisionLoading ? (
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      Verify FDR
                    </button>

                    <button
                      type="button"
                      className="btn btn-error btn-outline btn-sm"
                      disabled={
                        decisionLoading ||
                        decisionRemarks.trim().length < 3
                      }
                      onClick={() => decideFdr('reject')}
                    >
                      {decisionLoading ? (
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <XCircle size={16} />
                      )}
                      Reject / Flag Discrepancy
                    </button>
                  </div>
                </div>
              )}

            {/* Document management */}
            <div className="divider">FDR Documents</div>

            {canUpload && (
              <form
                onSubmit={uploadDocument}
                className="space-y-3 rounded-xl border p-4"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <Upload size={18} />
                  Upload FDR Certificate
                </div>

                <p className="text-xs opacity-70">
                  PDF only. Maximum file size: 5 MB.
                </p>

                <input
                  id="fdr-certificate-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  className="file-input file-input-bordered w-full"
                  onChange={(e) => {
                    setSelectedFile(e.target.files?.[0] || null)
                    setDocumentError('')
                    setDocumentSuccess('')
                  }}
                  disabled={uploading}
                />

                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Upload size={16} />
                  )}
                  Upload Certificate
                </button>
              </form>
            )}

            {/* Document messages */}
            {documentError && (
              <div className="alert alert-error mt-3">
                <span>{documentError}</span>

                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setDocumentError('')}
                  aria-label="Dismiss document error"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {documentSuccess && (
              <div className="alert alert-success mt-3">
                <span>{documentSuccess}</span>
              </div>
            )}

            {/* Uploaded documents */}
            <div className="mt-4 space-y-2">
              <h3 className="font-semibold">Uploaded Certificates</h3>

              {documents.length === 0 ? (
                <p className="py-3 text-sm opacity-60">
                  No certificates uploaded for this FDR.
                </p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText
                        size={20}
                        className="shrink-0 opacity-70"
                      />

                      <div className="min-w-0">
                        <p className="break-all text-sm font-medium">
                          {doc.original_filename || 'FDR certificate'}
                        </p>

                        {doc.created_at && (
                          <p className="text-xs opacity-60">
                            Uploaded: {fmtDate(doc.created_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm shrink-0"
                      onClick={() => downloadDocument(doc)}
                    >
                      <Download size={16} />
                      Download
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn"
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