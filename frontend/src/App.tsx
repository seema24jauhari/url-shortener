import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import PublicRoute from './routes/PublicRoute'
import ProtectedRoute from './routes/ProtectedRoute'
import ForgetPassword from './pages/ForgetPassword'
import ResetPassword from './pages/ResetPassword'
import { UserProvider, useUser } from './context/UserContext'
import ChangePassword from './pages/ChangePassword'
import UpdateProfile from './pages/UpdateProfile'
import NotFound from './pages/NotFound'
import Dashboard from './pages/Dashboard'

function NotFoundRedirect() {
  const { user } = useUser();

  if (user) {
    return <NotFound />;
  }

  return <Navigate to="/" replace />;
}


function App() {

  return (
    <>
      <UserProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forget-password" element={<ForgetPassword />} />
              <Route path='/reset-password' element={<ResetPassword />} />
              
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path='/dashboard' element={<Dashboard/>} />
              <Route path='/change-password' element={<ChangePassword />} />
              <Route path='/update-profile' element={<UpdateProfile />} />
          </Route>
          <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </BrowserRouter>
      </UserProvider>
    </>
  )
}

export default App
