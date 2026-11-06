import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { AUTH_PATTERNS, SERVICE_CLIENTS } from '@app/shared';
import type { CheckSessionRequest, JwtPayload } from '@app/shared';
import { sendToService } from '../../clients/rpc.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

/**
 * Global guard, right after JwtAuthGuard. A valid token only proves the auth
 * service issued it; the login may have been deleted, deactivated or demoted
 * since. So on every authenticated request the auth service is asked for the
 * user's current state:
 *   - deleted or deactivated -> 401 (the frontend logs the user out)
 *   - otherwise the token's claims are replaced by the current ones, so the
 *     next guards (password change, roles) use today's role, not the token's.
 * Public endpoints (no `request.user`) are skipped.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SERVICE_CLIENTS.auth) private readonly authClient: ClientProxy) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) return true;

    // 401 when the login is gone; 503 when the auth service is down (from sendToService).
    request.user = await sendToService<JwtPayload, CheckSessionRequest>(this.authClient, AUTH_PATTERNS.CHECK_SESSION, {
      user_id: request.user.sub,
    });
    return true;
  }
}
