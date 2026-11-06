import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../services/auth.service'
import { ApiError, setUnauthorizedHandler } from '../services/http'
import { clearToken, loadToken, saveToken, tokenExpiresAt } from '../services/token-storage'
import type { AuthUser } from '../types/auth'
import { AuthContext } from './auth-context'
import type { AuthContextValue, AuthState } from './auth-context'

const SESSION_EXPIRED = 'Your session has expired. Please log in again.'

function initialState(): AuthState {
  const token = loadToken()
  if (!token) return { status: 'anonymous' }
  const expiresAt = tokenExpiresAt(token)
  if (expiresAt !== null && expiresAt <= Date.now()) {
    clearToken()
    return { status: 'anonymous', notice: SESSION_EXPIRED }
  }
  return { status: 'checking' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  const logout = useCallback((notice?: string) => {
    clearToken()
    setState({ status: 'anonymous', notice })
  }, [])

  const authenticate = useCallback((token: string, user: AuthUser) => {
    saveToken(token)
    setState({ status: 'authenticated', token, user })
  }, [])

  // Page load: confirm the stored token with the server (it may be revoked or the user deactivated).
  useEffect(() => {
    if (state.status !== 'checking') return
    const token = loadToken()
    if (!token) return

    let cancelled = false
    authApi
      .fetchCurrentUser() // the axios interceptor sends the stored token
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', token, user })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // Server down or broken: keep the token and let the user retry, instead of logging them out.
        if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) {
          setState({ status: 'unavailable', message: error.message })
        } else {
          clearToken()
          setState({ status: 'anonymous', notice: SESSION_EXPIRED })
        }
      })
    return () => {
      cancelled = true
    }
  }, [state.status])

  // Any 401 on a request that carried our token means the session ended.
  useEffect(() => {
    setUnauthorizedHandler((message) => logout(message))
    return () => setUnauthorizedHandler(undefined)
  }, [logout])

  // Log out in the browser when the token expires, rather than on the next failed request.
  const token = state.status === 'authenticated' ? state.token : null
  useEffect(() => {
    if (!token) return
    const expiresAt = tokenExpiresAt(token)
    if (expiresAt === null) return
    const timer = window.setTimeout(() => logout(SESSION_EXPIRED), Math.max(0, expiresAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [token, logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      logout,
      retry: () => setState({ status: 'checking' }),
      login: async (email, password) => {
        const result = await authApi.login({ email, password })
        authenticate(result.access_token, result.user)
        return result.user
      },
      changePassword: async (currentPassword, newPassword) => {
        if (state.status !== 'authenticated') throw new ApiError(401, 'Please log in again.')
        const result = await authApi.changePassword({
          current_password: currentPassword,
          new_password: newPassword,
        })
        authenticate(result.access_token, result.user)
        return result.user
      },
    }),
    [state, logout, authenticate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
