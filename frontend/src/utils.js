export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN')
export const daysLeft = (d) => Math.ceil((new Date(d) - new Date(new Date().toDateString())) / 86400000)
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
export const STATUS_COLORS = {
  SUBMITTED: '#2563eb', UNDER_REVIEW: '#f59e0b', DISCREPANCY: '#dc2626',
  VERIFIED: '#16a34a', MATURED: '#64748b', RENEWED: '#7c3aed', RELEASED: '#0f766e',
}
