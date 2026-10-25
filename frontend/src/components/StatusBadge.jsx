const MAP = {
  SUBMITTED: 'badge-info', UNDER_REVIEW: 'badge-warning', DISCREPANCY: 'badge-error',
  VERIFIED: 'badge-success', MATURED: 'badge-neutral', RENEWED: 'badge-secondary', RELEASED: 'badge-accent',
}
export default function StatusBadge({ status }) {
  return <span className={`badge ${MAP[status] || 'badge-ghost'} badge-sm font-medium whitespace-nowrap`}>{status.replace('_', ' ')}</span>
}
