import { SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtPayload, Role } from '@app/shared';
import type { AuthenticatedRequest } from './authenticated-request.js';

export const IS_PUBLIC_KEY = 'auth:is-public';
export const ROLES_KEY = 'auth:roles';
export const ALLOW_DURING_PASSWORD_CHANGE_KEY = 'auth:allow-during-password-change';

/** Skips JwtAuthGuard: the endpoint works without a token (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Roles allowed to call the endpoint. ADMIN can also call EMPLOYEE endpoints
 * (HR are employees too). Without @Roles, any logged-in user may call it.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Reachable while the user still has to change a system-generated password. */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);

/** The verified token claims of the caller. Only on endpoints that require a token. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): JwtPayload => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new UnauthorizedException('Login required');
  return user;
});
