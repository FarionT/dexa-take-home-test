import { isRecord } from './api'

// Mirrors backend/docs/api/auth.md (snake_case data fields, as in the API).

export type Role = 'ADMIN' | 'EMPLOYEE'

export interface AuthUser {
  id: string
  employee_id: string
  email: string
  role: Role
  must_change_password: boolean
  last_login_at: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResult {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: AuthUser
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

// Password rules, same as the backend (bcrypt only uses the first 72 bytes).
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_BYTES = 72

function isRole(value: unknown): value is Role {
  return value === 'ADMIN' || value === 'EMPLOYEE'
}

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.employee_id === 'string' &&
    typeof value.email === 'string' &&
    isRole(value.role) &&
    typeof value.must_change_password === 'boolean' &&
    (value.last_login_at === null || typeof value.last_login_at === 'string')
  )
}

export function isLoginResult(value: unknown): value is LoginResult {
  return (
    isRecord(value) &&
    typeof value.access_token === 'string' &&
    value.token_type === 'Bearer' &&
    typeof value.expires_in === 'number' &&
    isAuthUser(value.user)
  )
}
