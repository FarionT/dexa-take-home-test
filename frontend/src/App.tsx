import { Route, Routes } from 'react-router'
import { GuestOnly, RequireAuth, RequireRole } from './auth/RouteGuards'
import {
  ChangePasswordPage,
  EmployeeCreatePage,
  EmployeeDetailPage,
  EmployeeEditPage,
  EmployeesPage,
  HomePage,
  LoginPage,
  NotFoundPage,
} from './pages'

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

        {/* HR only. The backend refuses these requests for other roles too. */}
        <Route element={<RequireRole role="ADMIN" />}>
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/new" element={<EmployeeCreatePage />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/employees/:id/edit" element={<EmployeeEditPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
