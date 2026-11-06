import { HttpException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { AUTH_PATTERNS, SERVICE_CLIENTS } from '@app/shared';
import type { JwtPayload } from '@app/shared';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { SessionGuard } from './session.guard.js';

const FROM_TOKEN: JwtPayload = { sub: 'u-1', employee_id: 'e-1', role: 'ADMIN', must_change_password: false };

/** A real Nest context whose switchToHttp().getRequest() is `request`. */
function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContextHost {
  return new ExecutionContextHost([request]);
}

describe('SessionGuard', () => {
  const send = vi.fn<(pattern: string, payload: unknown) => Observable<unknown>>();
  let guard: SessionGuard;

  beforeEach(async () => {
    send.mockReset();
    const module = await Test.createTestingModule({
      providers: [SessionGuard, { provide: SERVICE_CLIENTS.auth, useValue: { send } }],
    }).compile();
    guard = module.get(SessionGuard);
  });

  it('replaces the token claims with the current ones (e.g. a demoted admin)', async () => {
    const current: JwtPayload = { ...FROM_TOKEN, role: 'EMPLOYEE' };
    send.mockReturnValue(of(current));
    const request: Partial<AuthenticatedRequest> = { user: FROM_TOKEN };

    expect(await guard.canActivate(contextFor(request))).toBe(true);

    expect(send).toHaveBeenCalledWith(AUTH_PATTERNS.CHECK_SESSION, { user_id: 'u-1' });
    expect(request.user).toEqual(current);
  });

  it('turns a deleted or deactivated login into 401', async () => {
    send.mockReturnValue(throwError(() => ({ status_code: 401, message: 'Your session is no longer valid. Please log in again.' })));

    const error = await guard.canActivate(contextFor({ user: FROM_TOKEN })).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error instanceof HttpException && error.getStatus()).toBe(401);
  });

  it('skips public requests (no user)', async () => {
    expect(await guard.canActivate(contextFor({}))).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
});
