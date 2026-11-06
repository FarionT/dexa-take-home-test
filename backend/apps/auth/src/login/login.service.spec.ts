import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { PasswordService } from '../passwords/password.service.js';
import { User } from '../users/user.model.js';
import { LoginService } from './login.service.js';

// Real bcrypt (low cost to keep tests fast); fake database model and JWT signer.
const PASSWORD = 'Secret123';

interface FakeUser {
  id: string;
  employee_id: string;
  email: string;
  password_hash: string;
  role: 'ADMIN' | 'EMPLOYEE';
  must_change_password: boolean;
  is_active: boolean;
  last_login_at: Date | null;
  update: ReturnType<typeof vi.fn>;
}

async function fakeUser(overrides: Partial<FakeUser> = {}): Promise<FakeUser> {
  const user: FakeUser = {
    id: 'user-1',
    employee_id: 'emp-1',
    email: 'budi@dexa.com',
    password_hash: await hash(PASSWORD, 4),
    role: 'EMPLOYEE',
    must_change_password: false,
    is_active: true,
    last_login_at: null,
    update: vi.fn(),
    ...overrides,
  };
  // Like Sequelize's instance.update(): applies the changes to the instance.
  user.update.mockImplementation((changes: Partial<FakeUser>) => Object.assign(user, changes));
  return user;
}

/** The payload an RpcException carries, e.g. { status_code: 401, message: '…' }. */
async function rpcErrorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof RpcException) return error.getError();
    throw error;
  }
  throw new Error('expected an RpcException');
}

describe('LoginService', () => {
  const users = { findOne: vi.fn(), findByPk: vi.fn() };
  const signAsync = vi.fn<(payload: object) => Promise<string>>();
  let service: LoginService;
  let passwords: PasswordService;

  beforeEach(async () => {
    users.findOne.mockReset();
    users.findByPk.mockReset();
    signAsync.mockReset().mockResolvedValue('signed-token');
    const module = await Test.createTestingModule({
      providers: [
        LoginService,
        PasswordService,
        { provide: getModelToken(User), useValue: users },
        { provide: JwtService, useValue: { signAsync } },
        { provide: ConfigService, useValue: { getOrThrow: () => '1d' } },
      ],
    }).compile();
    service = module.get(LoginService);
    passwords = module.get(PasswordService);
  });

  describe('login', () => {
    it('returns a token with the user claims and records the login time', async () => {
      const user = await fakeUser({ role: 'ADMIN' });
      users.findOne.mockResolvedValue(user);

      const result = await service.login({ email: '  Budi@Dexa.com ', password: PASSWORD });

      expect(users.findOne).toHaveBeenCalledWith({ where: { email: 'budi@dexa.com' } });
      expect(signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', employee_id: 'emp-1', role: 'ADMIN', must_change_password: false },
        { expiresIn: 86400 },
      );
      expect(result).toMatchObject({ access_token: 'signed-token', token_type: 'Bearer', expires_in: 86400 });
      expect(result.user).not.toHaveProperty('password_hash');
      expect(user.update).toHaveBeenCalledWith({ last_login_at: expect.any(Date) });
    });

    it('rejects a wrong password with the generic message', async () => {
      users.findOne.mockResolvedValue(await fakeUser());

      expect(await rpcErrorOf(service.login({ email: 'budi@dexa.com', password: 'wrong' }))).toEqual({
        status_code: 401,
        message: 'Invalid email or password',
      });
    });

    it('rejects an unknown email with the same message, still running bcrypt', async () => {
      users.findOne.mockResolvedValue(null);
      const verify = vi.spyOn(passwords, 'verify');

      expect(await rpcErrorOf(service.login({ email: 'nobody@dexa.com', password: PASSWORD }))).toEqual({
        status_code: 401,
        message: 'Invalid email or password',
      });
      expect(verify).toHaveBeenCalledWith(PASSWORD, undefined);
    });

    it('rejects a deactivated account only after a correct password', async () => {
      users.findOne.mockResolvedValue(await fakeUser({ is_active: false }));

      expect(await rpcErrorOf(service.login({ email: 'budi@dexa.com', password: PASSWORD }))).toMatchObject({
        status_code: 403,
      });
      expect(await rpcErrorOf(service.login({ email: 'budi@dexa.com', password: 'wrong' }))).toMatchObject({
        status_code: 401,
      });
    });
  });

  describe('me', () => {
    it('returns the user without the password hash', async () => {
      users.findByPk.mockResolvedValue(await fakeUser());

      const me = await service.me({ user_id: 'user-1' });

      expect(me).toEqual({
        id: 'user-1',
        employee_id: 'emp-1',
        email: 'budi@dexa.com',
        role: 'EMPLOYEE',
        must_change_password: false,
        last_login_at: null,
      });
    });

    it.each([
      ['deleted', null],
      ['deactivated', { is_active: false }],
    ])('rejects a %s user with 401', async (_label, state) => {
      users.findByPk.mockResolvedValue(state && (await fakeUser(state)));

      expect(await rpcErrorOf(service.me({ user_id: 'user-1' }))).toMatchObject({ status_code: 401 });
    });
  });

  describe('changePassword', () => {
    it('stores a new bcrypt hash, clears must_change_password and returns a new token', async () => {
      const user = await fakeUser({ must_change_password: true });
      users.findByPk.mockResolvedValue(user);

      const result = await service.changePassword({
        user_id: 'user-1',
        current_password: PASSWORD,
        new_password: 'NewSecret456',
      });

      expect(user.must_change_password).toBe(false);
      expect(user.password_hash).toMatch(/^\$2b\$12\$/);
      expect(await passwords.verify('NewSecret456', user.password_hash)).toBe(true);
      expect(await passwords.verify(PASSWORD, user.password_hash)).toBe(false);
      expect(signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ must_change_password: false }),
        expect.anything(),
      );
      expect(result.user.must_change_password).toBe(false);
    });

    it('rejects a wrong current password', async () => {
      users.findByPk.mockResolvedValue(await fakeUser());

      expect(
        await rpcErrorOf(
          service.changePassword({ user_id: 'user-1', current_password: 'wrong', new_password: 'NewSecret456' }),
        ),
      ).toEqual({ status_code: 400, message: 'Current password is incorrect' });
    });

    it('rejects reusing the current password', async () => {
      users.findByPk.mockResolvedValue(await fakeUser());

      expect(
        await rpcErrorOf(
          service.changePassword({ user_id: 'user-1', current_password: PASSWORD, new_password: PASSWORD }),
        ),
      ).toMatchObject({ status_code: 400 });
    });
  });
});
