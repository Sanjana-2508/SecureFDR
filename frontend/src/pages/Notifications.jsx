import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import api, { errMsg } from '../api'
import { useAuth } from '../AuthContext'
import { fmtDate } from '../utils'

function levelClass(level) {
  if (level === 'danger') return 'border-error bg-error/5'
  if (level === 'warning') return 'border-warning bg-warning/5'
  return 'border-base-300 bg-base-100'
}

export default function Notifications() {
  const { user } = useAuth()
  const canGenerate = ['OFFICER', 'ADMIN'].includes(user?.role)

  const [items, setItems] = useState([])
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [scanResult, setScanResult] = useState(null)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data } = await api.get('/notifications', {
        params: { unread_only: unreadOnly },
      })
      setItems(data.notifications || [])
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }, [unreadOnly])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  async function markRead(id) {
    setWorkingId(id)
    setError('')
    setSuccess('')

    try {
      await api.patch(`/notifications/${id}/read`)
      setSuccess('Notification marked as read.')
      await loadNotifications()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setWorkingId(null)
    }
  }

  async function generateAlerts() {
    if (
      !window.confirm(
        'Run the maturity-alert scan now? Existing alerts will not be duplicated.'
      )
    ) {
      return
    }

    setScanning(true)
    setError('')
    setSuccess('')
    setScanResult(null)

    try {
      const { data } = await api.post(
        '/notifications/generate-maturity-alerts'
      )
      setScanResult(data)
      setSuccess(data.message || 'Maturity-alert scan completed.')
      await loadNotifications()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setScanning(false)
    }
  }

  const unreadCount = items.filter((item) => !item.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary">
              <Bell size={21} />
            </span>
            Notifications
          </h1>
          <p className="page-subtitle mt-2 text-sm">
            View FDR updates, maturity reminders, and workflow decisions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadNotifications}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {canGenerate && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={generateAlerts}
              disabled={scanning}
            >
              {scanning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldAlert size={16} />
              )}
              Scan maturity alerts
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {scanResult && (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">
              <AlertTriangle size={19} />
              Maturity scan summary
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-base-200 p-3">
                <p className="text-xs opacity-70">Scan date</p>
                <p className="font-semibold">{scanResult.scan_date}</p>
              </div>
              <div className="rounded-lg bg-base-200 p-3">
                <p className="text-xs opacity-70">Upcoming FDRs</p>
                <p className="text-xl font-bold">
                  {scanResult.upcoming_fdrs_found}
                </p>
              </div>
              <div className="rounded-lg bg-base-200 p-3">
                <p className="text-xs opacity-70">Overdue FDRs</p>
                <p className="text-xl font-bold">
                  {scanResult.overdue_fdrs_found}
                </p>
              </div>
              <div className="rounded-lg bg-base-200 p-3">
                <p className="text-xs opacity-70">Notifications created</p>
                <p className="text-xl font-bold">
                  {scanResult.notifications_created}
                </p>
              </div>
            </div>

            {scanResult.duplicate_or_unassigned_alerts_skipped > 0 && (
              <p className="text-sm text-warning">
                Skipped alerts: {scanResult.duplicate_or_unassigned_alerts_skipped}.
                This can include existing duplicate alerts or FDRs without
                eligible institution recipients.
              </p>
            )}

            <p className="text-xs opacity-60">
              {scanResult.note}
            </p>
          </div>
        </div>
      )}

      <div className="card bg-white">
        <div className="card-body">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="card-title text-lg">Your alerts</h2>
              <p className="text-sm opacity-60">
                {unreadOnly ? 'Showing unread notifications only.' : 'Showing all notifications.'}
              </p>
            </div>

            <label className="label cursor-pointer gap-2">
              <span className="label-text">Unread only</span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
            </label>
          </div>

          {!loading && (
            <div className="text-sm opacity-70">
              {items.length} notification{items.length === 1 ? '' : 's'}
              {!unreadOnly && ` · ${unreadCount} unread`}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <Bell size={34} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">You're all caught up!</p>
              <p className="mt-1 text-sm opacity-60">
                No notifications match this filter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={`workflow-item rounded-xl border p-4 ${levelClass(item.level)} ${
                    item.is_read ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        item.level === 'danger'
                          ? 'bg-red-50'
                          : item.level === 'warning'
                            ? 'bg-amber-50'
                            : 'bg-blue-50'
                      }`}>
                        {item.level === 'danger' ? (
                          <AlertTriangle size={20} className="text-error" />
                        ) : (
                          <Bell size={20} className="text-primary" />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{item.title}</h3>
                          {!item.is_read && (
                            <span className="badge badge-primary badge-sm">
                              New
                            </span>
                          )}
                        </div>

                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {item.message}
                        </p>

                        <p className="mt-2 text-xs opacity-60">
                          {fmtDate(item.created_at)}
                          {item.fdr_id != null &&
                            ` · FDR record #${item.fdr_id}`}
                        </p>
                      </div>
                    </div>

                    {!item.is_read && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm shrink-0"
                        disabled={workingId === item.id}
                        onClick={() => markRead(item.id)}
                      >
                        {workingId === item.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Check size={15} />
                        )}
                        Mark as read
                      </button>
                    )}

                    {item.is_read && (
                      <span className="flex items-center gap-1 text-xs opacity-60">
                        <CheckCheck size={15} />
                        Read
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}