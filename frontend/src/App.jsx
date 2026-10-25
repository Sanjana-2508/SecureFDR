import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import FdrList from './pages/FdrList'
import AuditLog from './pages/AuditLog'
import Users from './pages/Users'

function Protected({ roles, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg text-primary" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/fdrs" element={<FdrList />} />
        <Route path="/audit" element={<Protected roles={['OFFICER', 'ADMIN']}><AuditLog /></Protected>} />
        <Route path="/users" element={<Protected roles={['ADMIN']}><Users /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
