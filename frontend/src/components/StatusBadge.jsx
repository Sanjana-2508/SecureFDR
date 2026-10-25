const MAP = {
  SUBMITTED: 'status-badge-submitted',
  UNDER_REVIEW: 'status-badge-pending',
  DISCREPANCY: 'status-badge-danger',
  VERIFIED: 'status-badge-success',
  MATURED: 'status-badge-matured',
  RENEWED: 'status-badge-renewed',
  RELEASED: 'status-badge-released',
}
export default function StatusBadge({ status }) {
  return (
    <span
      className={`badge status-badge ${MAP[status] || 'status-badge-default'}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}
