import type { AuthUser, ChangePasswordRequest, LoginRequest, LoginResult } from '../types/auth'
import { isAuthUser, isLoginResult } from '../types/auth'
import { parseWith, request } from './http'

// Endpoints: backend/docs/api/auth.md. The token is added by the axios interceptor in http.ts.

export function login(body: LoginRequest): Promise<LoginResult> {
  return request({ method: 'POST', url: '/auth/login', data: body }, parseWith(isLoginResult, 'login result'))
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return request({ method: 'GET', url: '/auth/me' }, parseWith(isAuthUser, 'user'))
}

/** Returns a new token: the old one may still say must_change_password. */
export function changePassword(body: ChangePasswordRequest): Promise<LoginResult> {
  return request(
    { method: 'POST', url: '/auth/change-password', data: body },
    parseWith(isLoginResult, 'login result'),
  )
}
