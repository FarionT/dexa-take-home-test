import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../types/auth'

export interface PasswordRule {
  id: string
  label: string
  met: boolean
}

/** The backend's new-password rules, checked live while the user types. */
export function checkPasswordRules(password: string): PasswordRule[] {
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'letter', label: 'At least one letter', met: /[A-Za-z]/.test(password) },
    { id: 'number', label: 'At least one number', met: /\d/.test(password) },
    {
      id: 'bytes',
      label: `At most ${PASSWORD_MAX_BYTES} bytes`,
      // Bytes, not characters: "é" is 2 bytes. bcrypt ignores anything past 72 bytes.
      met: new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES,
    },
  ]
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A quick check before sending; the server does the real validation. */
export function looksLikeEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}
