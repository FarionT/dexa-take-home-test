import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_DURING_PASSWORD_CHANGE_KEY } from '../auth.decorators.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

/**
 * Global guard: a user who still has a system-generated password may only use
 * endpoints marked @AllowDuringPasswordChange() (change password, /auth/me).
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user?.must_change_password) return true; // public endpoint or normal user

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed) {
      throw new ForbiddenException('Please change your password before continuing.');
    }
    return true;
  }
}
