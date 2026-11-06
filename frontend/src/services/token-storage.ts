import { isRecord } from '../types/api'

const TOKEN_KEY = 'dexa.access_token'

// localStorage keeps the user logged in across page reloads. Trade-off: any
// script injected into the page could read it (see frontend/README.md → Notes).
// Storage can be blocked (private mode, browser settings), so every access is
// wrapped, and an in-memory copy keeps the current tab working regardless.
let memoryToken: string | null = null

export function loadToken(): string | null {
  if (memoryToken) return memoryToken
  try {
    memoryToken = localStorage.getItem(TOKEN_KEY)
  } catch {
    // Storage blocked: only the in-memory copy (none yet) is available.
  }
  return memoryToken
}

export function saveToken(token: string): void {
  memoryToken = token
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage blocked: the session works until the page is reloaded.
  }
}

export function clearToken(): void {
  memoryToken = null
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/**
 * The token's expiry (`exp` claim) in milliseconds, or null if unreadable.
 * Only used to log out on time in the browser; the server checks the token itself.
 */
export function tokenExpiresAt(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1] ?? ''
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))
    const claims: unknown = JSON.parse(json)
    return isRecord(claims) && typeof claims.exp === 'number' ? claims.exp * 1000 : null
  } catch {
    return null
  }
}
