import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { FullPageMessage } from '../components'
import type { Role } from '../types/auth'
import { redirectFrom } from '../utils/location-state'
import { useAuth } from './useAuth'

/**
 * Pages for logged-in users. Users who still have a system-generated password
 * are sent to /change-password, except on the page that allows it.
 * (The backend enforces the same rules; this only decides what to show.)
 */
export function RequireAuth({ allowPasswordChange = false }: { allowPasswordChange?: boolean }) {
  const { state, retry } = useAuth()
  const location = useLocation()

  if (state.status === 'checking') return <FullPageMessage loading title="Checking your session…" />
  if (state.status === 'unavailable') {
    return <FullPageMessage title="Can't reach the server" description={state.message} action={{ label: 'Try again', onClick: retry }} />
  }
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (state.user.must_change_password && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

/** Pages for logged-out users (login). Logged-in users are sent on. */
export function GuestOnly() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'checking') return <FullPageMessage loading title="Checking your session…" />
  if (state.status === 'authenticated') {
    if (state.user.must_change_password) return <Navigate to="/change-password" replace />
    const from = redirectFrom(location.state)
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }
  return <Outlet />
}

/**
 * Pages for one role, inside RequireAuth. Others get a "no access" message
 * (the backend also refuses their requests with 403).
 */
export function RequireRole({ role }: { role: Role }) {
  const { state } = useAuth()
  const navigate = useNavigate()

  if (state.status === 'authenticated' && state.user.role !== role) {
    return (
      <FullPageMessage
        title="You don't have access to this page"
        description="This page is for HR admins only."
        action={{ label: 'Go to home', onClick: () => navigate('/') }}
      />
    )
  }
  return <Outlet />
}
