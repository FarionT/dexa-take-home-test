import { createContext } from 'react'
import type { AuthUser } from '../types/auth'

export type AuthState =
  /** Checking a stored token with the server (page load). */
  | { status: 'checking' }
  /** The server couldn't be reached while checking; the stored token is kept for a retry. */
  | { status: 'unavailable'; message: string }
  /** Logged out. `notice` explains why, e.g. an expired session. */
  | { status: 'anonymous'; notice?: string }
  | { status: 'authenticated'; token: string; user: AuthUser }

export interface AuthContextValue {
  state: AuthState
  /** Logs in and stores the token. Throws ApiError on failure. */
  login: (email: string, password: string) => Promise<AuthUser>
  /** Changes the password and switches to the new token. Throws ApiError on failure. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>
  logout: (notice?: string) => void
  /** Checks the stored token again after the server was unavailable. */
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
