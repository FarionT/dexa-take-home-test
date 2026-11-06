import { Controller, Get, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { AUTH_PATTERNS, SERVICE_CLIENTS, createPing } from '@app/shared';
import type { JwtPayload } from '@app/shared';
import { Roles } from '../src/auth/auth.decorators.js';
import { GatewayModule } from '../src/gateway.module.js';

const SECRET = 'e2e-test-secret-that-is-long-enough-123';

/** Test-only endpoints to exercise the global guards (no ADMIN feature exists yet). */
@Controller('probe')
class ProbeController {
  @Get('any')
  any() {
    return { ok: true };
  }

  @Roles('EMPLOYEE')
  @Get('employee')
  employee() {
    return { ok: true };
  }

  @Roles('ADMIN')
  @Get('admin')
  admin() {
    return { ok: true };
  }

  @Post('nothing')
  nothing(): void {}

  @Get('crash')
  crash(): never {
    throw new Error('database password is hunter2'); // must never reach the client
  }
}

const EMPLOYEE: JwtPayload = { sub: 'user-1', employee_id: 'emp-1', role: 'EMPLOYEE', must_change_password: false };
const ADMIN: JwtPayload = { sub: 'user-2', employee_id: 'emp-2', role: 'ADMIN', must_change_password: false };
const LOGIN_RESULT = {
  access_token: 'token-from-auth-service',
  token_type: 'Bearer',
  expires_in: 86400,
  user: { id: 'user-1', employee_id: 'emp-1', email: 'budi@dexa.com', role: 'EMPLOYEE', must_change_password: false, last_login_at: null },
};

describe('Gateway (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  // Fake auth service: answers ping by default; each test sets the other replies.
  const authSend = vi.fn<(pattern: string, payload: unknown) => Observable<unknown>>();
  const servicePing = (key: 'employee' | 'attendance') => ({ send: () => of(createPing(key, 'up')) });

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  beforeEach(async () => {
    authSend.mockReset().mockImplementation((pattern) =>
      pattern === AUTH_PATTERNS.PING ? of(createPing('auth', 'up')) : throwError(() => new Error(`unexpected ${pattern}`)),
    );
    const module = await Test.createTestingModule({ imports: [GatewayModule], controllers: [ProbeController] })
      .overrideProvider(SERVICE_CLIENTS.auth)
      .useValue({ send: authSend })
      .overrideProvider(SERVICE_CLIENTS.employee)
      .useValue(servicePing('employee'))
      .overrideProvider(SERVICE_CLIENTS.attendance)
      .useValue(servicePing('attendance'))
      .compile();
    app = module.createNestApplication();
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  const tokenFor = (payload: JwtPayload) => jwt.signAsync(payload);
  const http = () => request(app.getHttpServer());

  describe('public endpoints', () => {
    it('GET /health works without a token', async () => {
      const res = await http().get('/health').expect(200);
      expect(res.body).toMatchObject({
        status: 200,
        message: 'Service health',
        data: { status: 'ok', services: { auth: { status: 'up' } } },
      });
    });
  });

  describe('POST /auth/login', () => {
    it('forwards the normalized email and returns the token', async () => {
      authSend.mockReturnValueOnce(of(LOGIN_RESULT));

      const res = await http().post('/auth/login').send({ email: '  Budi@Dexa.COM ', password: 'Secret123' }).expect(200);

      expect(res.body).toEqual({ status: 200, message: 'Login successful', data: LOGIN_RESULT });
      expect(authSend).toHaveBeenCalledWith(AUTH_PATTERNS.LOGIN, { email: 'budi@dexa.com', password: 'Secret123' });
    });

    it('rejects an invalid body with a 400 listing every problem in data.errors', async () => {
      const res = await http().post('/auth/login').send({ email: 'not-an-email', role: 'ADMIN' }).expect(400);

      expect(res.body).toMatchObject({ status: 400, message: 'Validation failed' });
      expect(res.body.data.errors).toEqual(
        expect.arrayContaining([
          'email must be a valid email address',
          'password is required',
          'property role should not exist',
        ]),
      );
      expect(authSend).not.toHaveBeenCalledWith(AUTH_PATTERNS.LOGIN, expect.anything());
    });

    it('rejects a password longer than 72 bytes', async () => {
      const res = await http().post('/auth/login').send({ email: 'budi@dexa.com', password: 'é'.repeat(37) }).expect(400);
      expect(res.body.data.errors).toContain('password must be at most 72 bytes');
    });

    it('passes the auth service error through as an HTTP error', async () => {
      authSend.mockReturnValueOnce(throwError(() => ({ status_code: 401, message: 'Invalid email or password' })));

      const res = await http().post('/auth/login').send({ email: 'budi@dexa.com', password: 'wrong' }).expect(401);

      expect(res.body).toEqual({ status: 401, message: 'Invalid email or password' });
    });

    it('returns 503 when the auth service is down', async () => {
      const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3001'), { code: 'ECONNREFUSED' });
      authSend.mockReturnValueOnce(throwError(() => refused));

      const res = await http().post('/auth/login').send({ email: 'budi@dexa.com', password: 'Secret123' }).expect(503);

      expect(res.body).toEqual({ status: 503, message: 'Service is temporarily unavailable. Please try again.' });
      expect(JSON.stringify(res.body)).not.toContain('127.0.0.1'); // internals stay in the logs
    });
  });

  describe('token checks (JwtAuthGuard)', () => {
    it.each([
      ['no header', undefined],
      ['wrong scheme', 'Basic abc'],
      ['garbage token', 'Bearer not.a.jwt'],
    ])('rejects %s with 401', async (_label, header) => {
      const req = http().get('/auth/me');
      const res = await (header ? req.set('Authorization', header) : req).expect(401);
      expect(res.body).toMatchObject({ status: 401 });
      expect(res.body).not.toHaveProperty('data');
    });

    it('rejects an expired token', async () => {
      const expired = await jwt.signAsync({ ...EMPLOYEE, exp: Math.floor(Date.now() / 1000) - 60 });
      await http().get('/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const forged = await jwt.signAsync(ADMIN, { secret: 'attacker-secret-attacker-secret-1234' });
      await http().get('/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('GET /auth/me sends the user id from the token, not from the request', async () => {
      authSend.mockReturnValueOnce(of(LOGIN_RESULT.user));

      await http()
        .get('/auth/me?user_id=someone-else')
        .set('Authorization', `Bearer ${await tokenFor(EMPLOYEE)}`)
        .expect(200);

      expect(authSend).toHaveBeenCalledWith(AUTH_PATTERNS.ME, { user_id: 'user-1' });
    });
  });

  describe('roles (RolesGuard)', () => {
    it.each([
      ['EMPLOYEE', EMPLOYEE, '/probe/employee', 200],
      ['EMPLOYEE', EMPLOYEE, '/probe/admin', 403],
      ['ADMIN', ADMIN, '/probe/admin', 200],
      ['ADMIN', ADMIN, '/probe/employee', 200], // HR are employees too
      ['EMPLOYEE', EMPLOYEE, '/probe/any', 200], // no @Roles: any logged-in user
    ])('%s on %s -> %i', async (_role, user, path, status) => {
      await http().get(path).set('Authorization', `Bearer ${await tokenFor(user)}`).expect(status);
    });
  });

  describe('must_change_password (PasswordChangeGuard)', () => {
    const mustChange: JwtPayload = { ...EMPLOYEE, must_change_password: true };

    it('blocks other endpoints until the password is changed', async () => {
      const res = await http().get('/probe/any').set('Authorization', `Bearer ${await tokenFor(mustChange)}`).expect(403);
      expect(res.body).toEqual({ status: 403, message: 'Please change your password before continuing.' });
    });

    it('still allows /auth/me and /auth/change-password', async () => {
      const token = await tokenFor(mustChange);
      authSend.mockReturnValueOnce(of(LOGIN_RESULT.user)).mockReturnValueOnce(of(LOGIN_RESULT));

      await http().get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      await http()
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ current_password: 'Generated1', new_password: 'MyNewPass1' })
        .expect(200);

      expect(authSend).toHaveBeenCalledWith(AUTH_PATTERNS.CHANGE_PASSWORD, {
        user_id: 'user-1',
        current_password: 'Generated1',
        new_password: 'MyNewPass1',
      });
    });
  });

  describe('POST /auth/change-password validation', () => {
    it.each([
      ['too short', 'Ab1', 'new_password must be at least 8 characters'],
      ['no number', 'OnlyLetters', 'new_password must contain a number'],
      ['no letter', '1234567890', 'new_password must contain a letter'],
    ])('rejects a new password that is %s', async (_label, newPassword, message) => {
      const res = await http()
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${await tokenFor(EMPLOYEE)}`)
        .send({ current_password: 'Secret123', new_password: newPassword })
        .expect(400);
      expect(res.body.data.errors).toContain(message);
    });
  });

  describe('response envelope', () => {
    it('uses the default message when an endpoint sets none', async () => {
      const res = await http().get('/probe/any').set('Authorization', `Bearer ${await tokenFor(EMPLOYEE)}`).expect(200);
      expect(res.body).toEqual({ status: 200, message: 'Success', data: { ok: true } });
    });

    it('reports 201 for a POST without @HttpCode and leaves out data when there is none', async () => {
      const res = await http().post('/probe/nothing').set('Authorization', `Bearer ${await tokenFor(EMPLOYEE)}`).expect(201);
      expect(res.body).toEqual({ status: 201, message: 'Success' });
    });

    it('turns an unexpected error into a generic 500 without internal details', async () => {
      const res = await http().get('/probe/crash').set('Authorization', `Bearer ${await tokenFor(EMPLOYEE)}`).expect(500);
      expect(res.body).toEqual({ status: 500, message: 'Something went wrong. Please try again.' });
    });
  });
});
