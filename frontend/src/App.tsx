import { Route, Routes } from 'react-router'
import { GuestOnly, RequireAuth } from './auth/RouteGuards'
import { ChangePasswordPage, HomePage, LoginPage, NotFoundPage } from './pages'

function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Reachable while a temporary password still has to be changed. */}
      <Route element={<RequireAuth allowPasswordChange />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
