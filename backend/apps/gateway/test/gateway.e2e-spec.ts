import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Controller, Get, Logger, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { ATTENDANCE_PATTERNS, AUTH_PATTERNS, EMPLOYEE_PATTERNS, SERVICE_CLIENTS, createPing } from '@app/shared';
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
  const employeeSend = vi.fn<(pattern: string, payload: unknown) => Observable<unknown>>();
  const attendanceSend = vi.fn<(pattern: string, payload: unknown) => Observable<unknown>>();
  let uploadDir: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    // Photos go to a throwaway folder; 0.01 MB (~10 KB) makes the size limit easy to hit.
    uploadDir = await mkdtemp(path.join(tmpdir(), 'dexa-e2e-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.UPLOAD_MAX_SIZE_MB = '0.01';
  });

  afterAll(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    employeeSend.mockReset().mockImplementation((pattern) =>
      pattern === EMPLOYEE_PATTERNS.PING ? of(createPing('employee', 'up')) : throwError(() => new Error(`unexpected ${pattern}`)),
    );
    authSend.mockReset().mockImplementation((pattern) =>
      pattern === AUTH_PATTERNS.PING ? of(createPing('auth', 'up')) : throwError(() => new Error(`unexpected ${pattern}`)),
    );
    attendanceSend.mockReset().mockImplementation((pattern) =>
      pattern === ATTENDANCE_PATTERNS.PING ? of(createPing('attendance', 'up')) : throwError(() => new Error(`unexpected ${pattern}`)),
    );
    const module = await Test.createTestingModule({ imports: [GatewayModule], controllers: [ProbeController] })
      .overrideProvider(SERVICE_CLIENTS.auth)
      .useValue({ send: authSend })
      .overrideProvider(SERVICE_CLIENTS.employee)
      .useValue({ send: employeeSend })
      .overrideProvider(SERVICE_CLIENTS.attendance)
      .useValue({ send: attendanceSend })
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

  describe('employees', () => {
    const EMPLOYEE_RECORD = {
      id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      employee_code: 'EMP-0042',
      full_name: 'Budi Santoso',
      email: 'budi@dexa.com',
      phone: null,
      position: 'Developer',
      department: { id: 'd0000000-0000-4000-8000-000000000002', name: 'Engineering' },
      hire_date: '2026-01-05',
      status: 'ACTIVE',
      created_by: 'emp-2',
      updated_by: 'emp-2',
      created_at: '2026-11-06T07:00:00.000Z',
      updated_at: '2026-11-06T07:00:00.000Z',
    };
    const VALID_CREATE = {
      full_name: 'Budi Santoso',
      email: 'budi@dexa.com',
      position: 'Developer',
      department_id: 'd0000000-0000-4000-8000-000000000002',
      hire_date: '2026-01-05',
    };
    const asAdmin = async () => `Bearer ${await tokenFor(ADMIN)}`;
    const asEmployee = async () => `Bearer ${await tokenFor(EMPLOYEE)}`;

    it.each([
      ['GET', '/employees'],
      ['GET', '/departments'],
      ['POST', '/employees'],
      ['GET', `/employees/${EMPLOYEE_RECORD.id}`],
      ['PATCH', `/employees/${EMPLOYEE_RECORD.id}`],
      ['POST', `/employees/${EMPLOYEE_RECORD.id}/reset-password`],
      ['DELETE', `/employees/${EMPLOYEE_RECORD.id}`],
    ])('%s %s is HR only (403 for an EMPLOYEE)', async (method, path) => {
      const req = method === 'GET' ? http().get(path) : method === 'POST' ? http().post(path) : method === 'PATCH' ? http().patch(path) : http().delete(path);
      const res = await req.set('Authorization', await asEmployee()).send({}).expect(403);
      expect(res.body).toEqual({ status: 403, message: 'You do not have permission to do this.' });
    });

    it('GET /employees/me returns the caller\'s own profile (from the token, any role)', async () => {
      employeeSend.mockReturnValueOnce(of({ ...EMPLOYEE_RECORD, id: 'emp-1' }));
      authSend.mockReturnValueOnce(of([]));

      const res = await http().get('/employees/me').set('Authorization', await asEmployee()).expect(200);

      expect(res.body).toMatchObject({ status: 200, message: 'My profile', data: { id: 'emp-1', account: null } });
      expect(employeeSend).toHaveBeenCalledWith(EMPLOYEE_PATTERNS.FIND_ONE, { id: 'emp-1' });
    });

    it('GET /employees returns items and pagination meta', async () => {
      employeeSend.mockReturnValueOnce(of({ items: [EMPLOYEE_RECORD], total: 1 }));
      authSend.mockReturnValueOnce(of([]));

      const res = await http().get('/employees?search=budi&status=ACTIVE').set('Authorization', await asAdmin()).expect(200);

      expect(res.body).toMatchObject({ status: 200, message: 'Employees', data: { meta: { page: 1, limit: 10, total: 1, total_pages: 1 } } });
      expect(employeeSend).toHaveBeenCalledWith(EMPLOYEE_PATTERNS.LIST, expect.objectContaining({ page: 1, limit: 10, search: 'budi', status: 'ACTIVE' }));
    });

    it.each([
      ['limit too big', '?limit=500', 'limit must not be greater than 100'],
      ['page not a number', '?page=abc', 'page must be a whole number'],
      ['unknown status', '?status=FIRED', 'status must be one of: ACTIVE, INACTIVE'],
    ])('GET /employees rejects %s', async (_label, query, message) => {
      const res = await http().get(`/employees${query}`).set('Authorization', await asAdmin()).expect(400);
      expect(res.body.data.errors).toContain(message);
    });

    it('rejects an id that is not a UUID with 400', async () => {
      const res = await http().get('/employees/abc').set('Authorization', await asAdmin()).expect(400);
      expect(res.body.status).toBe(400);
    });

    it('POST /employees returns 201 with the temporary password', async () => {
      employeeSend.mockReturnValueOnce(of(EMPLOYEE_RECORD));
      authSend.mockReturnValueOnce(of({ account: { user_id: 'u-9', employee_id: EMPLOYEE_RECORD.id }, temporary_password: 'Tmp9xKq2mWp4Rz' }));

      const res = await http().post('/employees').set('Authorization', await asAdmin()).send({ ...VALID_CREATE, email: ' Budi@Dexa.COM ' }).expect(201);

      expect(res.body).toMatchObject({ status: 201, message: 'Employee created', data: { temporary_password: 'Tmp9xKq2mWp4Rz' } });
      expect(employeeSend).toHaveBeenCalledWith(
        EMPLOYEE_PATTERNS.CREATE,
        expect.objectContaining({ profile: expect.objectContaining({ email: 'budi@dexa.com', phone: null }), actor_employee_id: 'emp-2' }),
      );
    });

    it('POST /employees lists every validation problem', async () => {
      const res = await http()
        .post('/employees')
        .set('Authorization', await asAdmin())
        .send({ full_name: '  ', email: 'nope', phone: 'call me', position: 'Dev', department_id: '123', hire_date: '2026-02-30', role: 'BOSS', employee_code: 'EMP-9999' })
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(res.body.data.errors).toEqual(
        expect.arrayContaining([
          'full_name is required',
          'email must be a valid email address',
          expect.stringContaining('phone may only contain digits'),
          'department_id must be a valid id',
          'hire_date must be a valid date',
          'role must be one of: ADMIN, EMPLOYEE',
          'property employee_code should not exist', // the code is always generated
        ]),
      );
      expect(employeeSend).not.toHaveBeenCalledWith(EMPLOYEE_PATTERNS.CREATE, expect.anything());
    });

    it('PATCH /employees/:id with an empty body is 400', async () => {
      const res = await http().patch(`/employees/${EMPLOYEE_RECORD.id}`).set('Authorization', await asAdmin()).send({}).expect(400);
      expect(res.body).toEqual({ status: 400, message: 'Nothing to update: send at least one field' });
    });

    it('DELETE /employees/:id returns 200 without data', async () => {
      employeeSend.mockImplementation((pattern) => of(pattern === EMPLOYEE_PATTERNS.FIND_ONE ? EMPLOYEE_RECORD : { id: EMPLOYEE_RECORD.id }));
      authSend.mockReturnValueOnce(of({ deleted: true }));

      const res = await http().delete(`/employees/${EMPLOYEE_RECORD.id}`).set('Authorization', await asAdmin()).expect(200);
      expect(res.body).toEqual({ status: 200, message: 'Employee deleted' });
    });
  });
  describe('attendance', () => {
    const ATTENDANCE_ID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';
    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const RECORD = {
      id: ATTENDANCE_ID,
      employee_id: 'emp-1',
      type: 'CHECK_IN',
      attendance_date: '2026-11-06',
      recorded_at: '2026-11-06T01:05:00.000Z',
      notes: 'From home',
      photo: { mime: 'image/jpeg', size: JPEG.length },
    };
    const asEmployee = async () => `Bearer ${await tokenFor(EMPLOYEE)}`;
    const activeEmployee = () => employeeSend.mockReturnValueOnce(of({ id: 'emp-1', status: 'ACTIVE' }));
    const storedFiles = async () => (await readdir(uploadDir, { recursive: true })).filter((name) => name.endsWith('.jpg'));

    beforeEach(async () => {
      await rm(path.join(uploadDir, 'attendance'), { recursive: true, force: true });
    });

    it('POST /attendance/check-in stores the photo and returns 201 with the record', async () => {
      activeEmployee();
      attendanceSend.mockReturnValueOnce(of(RECORD));

      const res = await http()
        .post('/attendance/check-in')
        .set('Authorization', await asEmployee())
        .field('notes', '  From home  ')
        .attach('photo', JPEG, { filename: 'selfie.jpg', contentType: 'image/jpeg' })
        .expect(201);

      expect(res.body).toEqual({
        status: 201,
        message: 'Checked in',
        data: { ...RECORD, photo: { ...RECORD.photo, url: `/attendance/${ATTENDANCE_ID}/photo` } },
      });
      const files = await storedFiles();
      expect(files).toHaveLength(1);
      expect(files[0]).not.toContain('selfie'); // the client's file name is never used
      expect(attendanceSend).toHaveBeenCalledWith(ATTENDANCE_PATTERNS.RECORD, {
        employee_id: 'emp-1', // from the token
        type: 'CHECK_IN',
        photo_path: expect.stringMatching(/^attendance\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/),
        photo_mime: 'image/jpeg',
        photo_size: JPEG.length,
        notes: 'From home',
      });
    });

    it('requires a photo', async () => {
      const res = await http().post('/attendance/check-in').set('Authorization', await asEmployee()).field('notes', 'hi').expect(400);
      expect(res.body).toEqual({ status: 400, message: 'photo is required' });
    });

    it('rejects a file that only claims to be a JPEG', async () => {
      const res = await http()
        .post('/attendance/check-in')
        .set('Authorization', await asEmployee())
        .attach('photo', Buffer.from('<html>not an image</html>'), { filename: 'fake.jpg', contentType: 'image/jpeg' })
        .expect(400);
      expect(res.body).toEqual({ status: 400, message: 'photo must be a JPEG, PNG or WebP image' });
      expect(await storedFiles()).toHaveLength(0);
    });

    it('rejects a photo over UPLOAD_MAX_SIZE_MB with 413', async () => {
      const big = Buffer.concat([JPEG, Buffer.alloc(20 * 1024)]);
      const res = await http()
        .post('/attendance/check-in')
        .set('Authorization', await asEmployee())
        .attach('photo', big, { filename: 'big.jpg', contentType: 'image/jpeg' })
        .expect(413);
      expect(res.body).toMatchObject({ status: 413 });
    });

    it('rejects fields other than notes (the time and employee are set by the server)', async () => {
      const res = await http()
        .post('/attendance/check-in')
        .set('Authorization', await asEmployee())
        .field('recorded_at', '2026-01-01T00:00:00Z')
        .attach('photo', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(400);
      expect(res.body.data.errors).toContain('property recorded_at should not exist');
    });

    it('passes the day rule error through and removes the unused photo', async () => {
      activeEmployee();
      attendanceSend.mockReturnValueOnce(throwError(() => ({ status_code: 400, message: 'You have not checked in today' })));

      const res = await http()
        .post('/attendance/check-out')
        .set('Authorization', await asEmployee())
        .attach('photo', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(400);

      expect(res.body).toEqual({ status: 400, message: 'You have not checked in today' });
      expect(await storedFiles()).toHaveLength(0);
    });

    it('needs a token', async () => {
      await http().post('/attendance/check-in').attach('photo', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' }).expect(401);
    });

    it('GET /attendance/me/today returns the day from the token', async () => {
      attendanceSend.mockReturnValueOnce(of({ employee_id: 'emp-1', attendance_date: '2026-11-06', check_in: null, check_out: null, work_minutes: null }));

      const res = await http().get('/attendance/me/today').set('Authorization', await asEmployee()).expect(200);

      expect(res.body).toMatchObject({ status: 200, message: "Today's attendance", data: { check_in: null, check_out: null } });
      expect(attendanceSend).toHaveBeenCalledWith(ATTENDANCE_PATTERNS.TODAY, { employee_id: 'emp-1' });
    });

    it.each([
      ['a bad date', '?date_from=2026-02-30', 'date_from must be a valid date'],
      ['a wrong format', '?date_to=06-11-2026', 'date_to must be a date in YYYY-MM-DD format'],
      ['limit too big', '?limit=101', 'limit must not be greater than 100'],
    ])('GET /attendance/me rejects %s', async (_label, query, message) => {
      const res = await http().get(`/attendance/me${query}`).set('Authorization', await asEmployee()).expect(400);
      expect(res.body.data.errors).toContain(message);
    });

    it('GET /attendance/:id/photo streams the image itself, not JSON', async () => {
      activeEmployee();
      attendanceSend.mockReturnValueOnce(of(RECORD));
      await http()
        .post('/attendance/check-in')
        .set('Authorization', await asEmployee())
        .attach('photo', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const payload = attendanceSend.mock.calls.find(([pattern]) => pattern === ATTENDANCE_PATTERNS.RECORD)?.[1];
      const photoPath =
        typeof payload === 'object' && payload !== null && 'photo_path' in payload && typeof payload.photo_path === 'string'
          ? payload.photo_path
          : 'missing';
      attendanceSend.mockReturnValueOnce(of({ photo_path: photoPath, photo_mime: 'image/jpeg' }));

      const res = await http().get(`/attendance/${ATTENDANCE_ID}/photo`).set('Authorization', await asEmployee()).expect(200);

      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, max-age=3600');
      expect(Buffer.compare(res.body as Buffer, JPEG)).toBe(0);
    });

    it('GET /attendance is HR only', async () => {
      const res = await http().get('/attendance').set('Authorization', await asEmployee()).expect(403);
      expect(res.body).toEqual({ status: 403, message: 'You do not have permission to do this.' });
    });

    it('GET /attendance lists everyone with names and the date range used', async () => {
      employeeSend.mockImplementation((pattern) =>
        pattern === EMPLOYEE_PATTERNS.FIND_IDS
          ? of(['emp-1'])
          : of([{ id: 'emp-1', employee_code: 'EMP-0002', full_name: 'Budi', department: { id: 'd-1', name: 'Eng' }, status: 'ACTIVE', is_deleted: false }]),
      );
      attendanceSend.mockReturnValueOnce(of({ items: [{ employee_id: 'emp-1', attendance_date: '2026-11-06', check_in: RECORD, check_out: null, work_minutes: null }], total: 1 }));

      const res = await http()
        .get('/attendance?date_from=2026-11-01&date_to=2026-11-06&search=%20budi%20&department_id=d0000000-0000-4000-8000-000000000002')
        .set('Authorization', `Bearer ${await tokenFor(ADMIN)}`)
        .expect(200);

      expect(res.body).toMatchObject({
        status: 200,
        message: 'Attendance',
        data: {
          items: [{ employee: { full_name: 'Budi' }, check_in: { photo: { url: `/attendance/${ATTENDANCE_ID}/photo` } } }],
          meta: { page: 1, limit: 10, total: 1, total_pages: 1, date_from: '2026-11-01', date_to: '2026-11-06' },
        },
      });
      expect(employeeSend).toHaveBeenCalledWith(EMPLOYEE_PATTERNS.FIND_IDS, { department_id: 'd0000000-0000-4000-8000-000000000002', search: 'budi' });
    });

    it('GET /attendance rejects a bad department_id', async () => {
      const res = await http().get('/attendance?department_id=abc').set('Authorization', `Bearer ${await tokenFor(ADMIN)}`).expect(400);
      expect(res.body.data.errors).toContain('department_id must be a valid id');
    });

    it("GET /attendance/:id/photo of someone else's record is a JSON 404", async () => {
      attendanceSend.mockReturnValueOnce(throwError(() => ({ status_code: 404, message: 'Attendance not found' })));
      const res = await http().get(`/attendance/${ATTENDANCE_ID}/photo`).set('Authorization', await asEmployee()).expect(404);
      expect(res.body).toEqual({ status: 404, message: 'Attendance not found' });
    });

    it('GET /attendance/:id/photo is a 404 when the file is missing on disk', async () => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      attendanceSend.mockReturnValueOnce(of({ photo_path: 'attendance/2026/11/gone.jpg', photo_mime: 'image/jpeg' }));
      const res = await http().get(`/attendance/${ATTENDANCE_ID}/photo`).set('Authorization', await asEmployee()).expect(404);
      expect(res.body).toEqual({ status: 404, message: 'Photo not found' });
    });
  });
});
