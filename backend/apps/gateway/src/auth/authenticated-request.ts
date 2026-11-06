import type { Request } from 'express';
import { ROLES } from '@app/shared';
import type { JwtPayload, Role } from '@app/shared';

/** A request after JwtAuthGuard: `user` holds the verified token claims. */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

function isRole(value: unknown): value is Role {
  return ROLES.some((role) => role === value);
}

/** Checks the claims' shape: the signature proves who issued the token, not what it contains. */
export function isJwtPayload(value: unknown): value is JwtPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sub' in value &&
    typeof value.sub === 'string' &&
    'employee_id' in value &&
    typeof value.employee_id === 'string' &&
    'role' in value &&
    isRole(value.role) &&
    'must_change_password' in value &&
    typeof value.must_change_password === 'boolean'
  );
}
