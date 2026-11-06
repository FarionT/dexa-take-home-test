import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@app/shared';
import { ROLES_KEY } from '../auth.decorators.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

/** True if `role` may call an endpoint that allows `required`. ADMIN includes EMPLOYEE. */
export function hasRole(role: Role, required: readonly Role[]): boolean {
  return required.includes(role) || (role === 'ADMIN' && required.includes('EMPLOYEE'));
}

/** Global guard: enforces @Roles(...). Endpoints without @Roles are open to any logged-in user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !hasRole(user.role, required)) {
      throw new ForbiddenException('You do not have permission to do this.');
    }
    return true;
  }
}
