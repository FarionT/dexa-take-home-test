import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../auth.decorators.js';
import { isJwtPayload } from '../authenticated-request.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

/**
 * Global guard: every endpoint needs a valid `Authorization: Bearer <token>`
 * unless it is marked @Public(). Stateless: only the signature and expiry are
 * checked here, no database lookup.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Login required');
    }

    let claims: unknown;
    try {
      claims = await this.jwt.verifyAsync(token);
    } catch {
      // Bad signature, expired or malformed: the reason is not shown to the client.
      throw new UnauthorizedException('Your session has expired or is invalid. Please log in again.');
    }
    if (!isJwtPayload(claims)) {
      throw new UnauthorizedException('Your session has expired or is invalid. Please log in again.');
    }

    request.user = claims;
    return true;
  }
}
