import { Navigate, Outlet } from 'react-router-dom'
import { useUser } from '../context/UserContext'

const ProtectedRoute = () => {
  const { user } = useUser()
  return user ? <Outlet /> : <Navigate to="/" replace />
}

export default ProtectedRoute