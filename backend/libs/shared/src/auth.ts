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

/**
 * Reply: the user's claims as they are NOW in the database (same shape as the
 * JWT), or 401 if the login was deleted or deactivated. The gateway uses these
 * instead of the token's, so a demotion or deletion takes effect at once.
 */
export interface CheckSessionRequest {
  user_id: string;
}

export interface ChangePasswordRequest {
  user_id: string;
  current_password: string;
  new_password: string;
}

// Account (login) data shown next to an employee, and the messages the gateway
// sends to manage it. One account per employee.

/** The login side of an employee. Never contains the password or its hash. */
export interface EmployeeAccount {
  user_id: string;
  employee_id: string;
  email: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
}

export interface CreateUserRequest {
  employee_id: string;
  email: string;
  role: Role;
}

/** A newly generated password, returned once so HR can hand it over. Never stored or logged. */
export interface TemporaryPasswordResult {
  temporary_password: string;
}

export interface CreateUserResult extends TemporaryPasswordResult {
  account: EmployeeAccount;
}

export interface FindAccountsRequest {
  employee_ids: string[];
}

export interface UpdateAccountRequest {
  /** The user making the change (JWT `sub`): checked by the role guardrails. */
  actor_user_id: string;
  employee_id: string;
  email?: string;
  role?: Role;
  is_active?: boolean;
}

export interface UpdateAccountResult {
  account: EmployeeAccount;
  /** Set when the account was reactivated: a new temporary password. */
  temporary_password: string | null;
}

export interface AccountActionRequest {
  actor_user_id: string;
  employee_id: string;
}

export interface RestoreUserRequest {
  employee_id: string;
}
