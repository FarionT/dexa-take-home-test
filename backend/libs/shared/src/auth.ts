import type { ConfigService } from '@nestjs/config';
import type { Role } from './domain.js';

/** bcrypt only uses the first 72 bytes of a password, so longer ones are rejected, not cut. */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_LENGTH = 8;

const JWT_SECRET_MIN_LENGTH = 32;

/** JWT_SECRET from config; both the auth service (signs) and the gateway (verifies) use it. */
export function getJwtSecret(config: ConfigService): string {
  const secret = config.getOrThrow<string>('JWT_SECRET');
  if (secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`);
  }
  return secret;
}

/** Emails are stored and compared lowercase and trimmed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Claims inside the JWT. Signed by the auth service, verified by the gateway. */
export interface JwtPayload {
  /** User id (dexa_auth.users.id). */
  sub: string;
  employee_id: string;
  role: Role;
  /** While true, the gateway only allows changing the password and reading /auth/me. */
  must_change_password: boolean;
}

/** A user as returned to other apps: never contains the password hash. */
export interface AuthUser {
  id: string;
  employee_id: string;
  email: string;
  role: Role;
  must_change_password: boolean;
  last_login_at: string | null;
}

/** Response of a successful login (and of a password change). */
export interface LoginResult {
  access_token: string;
  token_type: 'Bearer';
  /** Token lifetime in seconds. */
  expires_in: number;
  user: AuthUser;
}

// Message payloads (gateway -> auth service).
export interface LoginRequest {
  email: string;
  password: string;
}

export interface MeRequest {
  user_id: string;
}

export interface ChangePasswordRequest {
  user_id: string;
  current_password: string;
  new_password: string;
}
