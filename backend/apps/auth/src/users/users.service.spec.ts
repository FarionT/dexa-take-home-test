import { RpcException } from '@nestjs/microservices';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { compare } from 'bcryptjs';
import { Sequelize } from 'sequelize-typescript';
import { PasswordService } from '../passwords/password.service.js';
import { User } from './user.model.js';
import { UsersService } from './users.service.js';

// Fake model rows with the fields the service reads; update/destroy record what happened.
interface FakeUser {
  id: string;
  employee_id: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  is_active: boolean;
  must_change_password: boolean;
  password_hash: string;
  last_login_at: Date | null;
  update: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function fakeUser(overrides: Partial<FakeUser>): FakeUser {
  const user: FakeUser = {
    id: 'u-target',
    employee_id: 'e-target',
    email: 'target@dexa.com',
    role: 'EMPLOYEE',
    is_active: true,
    must_change_password: false,
    password_hash: 'old-hash',
    last_login_at: null,
    update: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
  user.update.mockImplementation((changes: Partial<FakeUser>) => Object.assign(user, changes));
  return user;
}

async function rpcErrorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof RpcException) return error.getError();
    throw error;
  }
  throw new Error('expected an RpcException');
}

describe('UsersService', () => {
  const users = { findOne: vi.fn(), findAll: vi.fn(), create: vi.fn() };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  // Runs the callback like a real transaction would, without a database.
  const sequelize = { transaction: vi.fn((work: (t: typeof transaction) => unknown) => work(transaction)) };
  let service: UsersService;

  const ACTOR = 'u-actor';
  const actorAdmin = () => fakeUser({ id: ACTOR, employee_id: 'e-actor', role: 'ADMIN' });

  beforeEach(async () => {
    Object.values(users).forEach((fn) => fn.mockReset());
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        PasswordService,
        { provide: Sequelize, useValue: sequelize },
        { provide: getModelToken(User), useValue: users },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('create', () => {
    it('stores only a bcrypt hash of a generated password and forces a change', async () => {
      users.findOne.mockResolvedValue(null);
      users.create.mockImplementation((data: Partial<FakeUser>) => fakeUser({ id: 'u-new', ...data }));

      const result = await service.create({ employee_id: 'e-new', email: ' New@Dexa.com ', role: 'EMPLOYEE' });

      const saved = users.create.mock.calls[0][0];
      expect(saved).toMatchObject({ email: 'new@dexa.com', must_change_password: true });
      expect(saved).not.toHaveProperty('password');
      expect(await compare(result.temporary_password, saved.password_hash)).toBe(true);
      expect(result.account).not.toHaveProperty('password_hash');
    });

    it('refuses an email that another login uses', async () => {
      users.findOne.mockResolvedValue(fakeUser({ employee_id: 'someone-else', email: 'new@dexa.com' }));
      expect(await rpcErrorOf(service.create({ employee_id: 'e-new', email: 'new@dexa.com', role: 'EMPLOYEE' }))).toEqual({
        status_code: 409,
        message: 'This email is already used by another login',
      });
    });
  });

  describe('updateAccount guardrails', () => {
    it('refuses changing your own role or deactivating yourself (403)', async () => {
      const self = actorAdmin();
      users.findAll.mockResolvedValue([self, fakeUser({ id: 'u-other-admin', role: 'ADMIN' })]);
      users.findOne.mockResolvedValue(self);

      for (const change of [{ role: 'EMPLOYEE' as const }, { is_active: false }]) {
        expect(await rpcErrorOf(service.updateAccount({ actor_user_id: ACTOR, employee_id: 'e-actor', ...change }))).toMatchObject({
          status_code: 403,
        });
      }
      expect(self.update).not.toHaveBeenCalled();
    });

    it('still lets you change your own email', async () => {
      const self = actorAdmin();
      users.findOne.mockResolvedValueOnce(self).mockResolvedValueOnce(null); // lookup, then email-free check
      const result = await service.updateAccount({ actor_user_id: ACTOR, employee_id: 'e-actor', email: 'me@dexa.com' });
      expect(result.account.email).toBe('me@dexa.com');
    });

    it.each([
      ['demoting', { role: 'EMPLOYEE' as const }],
      ['deactivating', { is_active: false }],
    ])('refuses %s the last active ADMIN (409)', async (_label, change) => {
      const lastAdmin = fakeUser({ role: 'ADMIN' });
      users.findAll.mockResolvedValue([lastAdmin]); // the locked active admins: only the target
      users.findOne.mockResolvedValue(lastAdmin);

      expect(await rpcErrorOf(service.updateAccount({ actor_user_id: ACTOR, employee_id: 'e-target', ...change }))).toEqual({
        status_code: 409,
        message: 'This is the last active HR admin. Make someone else HR admin first.',
      });
      expect(lastAdmin.update).not.toHaveBeenCalled();
    });

    it('allows demoting an ADMIN when another active ADMIN remains', async () => {
      const target = fakeUser({ role: 'ADMIN' });
      users.findAll.mockResolvedValue([target, actorAdmin()]);
      users.findOne.mockResolvedValue(target);

      const result = await service.updateAccount({ actor_user_id: ACTOR, employee_id: 'e-target', role: 'EMPLOYEE' });
      expect(result.account.role).toBe('EMPLOYEE');
    });

    it('locks the admin rows before the target row (no deadlock between concurrent changes)', async () => {
      const order: string[] = [];
      users.findAll.mockImplementation(() => (order.push('admins'), Promise.resolve([actorAdmin()])));
      users.findOne.mockImplementation(() => (order.push('target'), Promise.resolve(fakeUser({}))));

      await service.updateAccount({ actor_user_id: ACTOR, employee_id: 'e-target', role: 'ADMIN' });
      expect(order).toEqual(['admins', 'target']);
      expect(users.findAll).toHaveBeenCalledWith(expect.objectContaining({ lock: 'UPDATE' }));
    });

    it('reactivating issues a new temporary password and forces a change', async () => {
      const inactive = fakeUser({ is_active: false });
      users.findAll.mockResolvedValue([actorAdmin()]);
      users.findOne.mockResolvedValue(inactive);

      const result = await service.updateAccount({ actor_user_id: ACTOR, employee_id: 'e-target', is_active: true });

      expect(result.temporary_password).toMatch(/^[A-Za-z2-9]{14}$/);
      expect(inactive).toMatchObject({ is_active: true, must_change_password: true });
      expect(await compare(result.temporary_password ?? '', inactive.password_hash)).toBe(true);
    });

    it('returns 404 when the employee has no login', async () => {
      users.findOne.mockResolvedValue(null);
      expect(await rpcErrorOf(service.updateAccount({ actor_user_id: ACTOR, employee_id: 'e-x', email: 'x@dexa.com' }))).toMatchObject({
        status_code: 404,
      });
    });
  });

  describe('resetPassword', () => {
    it('refuses your own account and deactivated accounts', async () => {
      users.findOne.mockResolvedValueOnce(actorAdmin());
      expect(await rpcErrorOf(service.resetPassword({ actor_user_id: ACTOR, employee_id: 'e-actor' }))).toMatchObject({ status_code: 403 });

      users.findOne.mockResolvedValueOnce(fakeUser({ is_active: false }));
      expect(await rpcErrorOf(service.resetPassword({ actor_user_id: ACTOR, employee_id: 'e-target' }))).toMatchObject({ status_code: 409 });
    });

    it('sets a new temporary password', async () => {
      const target = fakeUser({});
      users.findOne.mockResolvedValue(target);
      const { temporary_password } = await service.resetPassword({ actor_user_id: ACTOR, employee_id: 'e-target' });
      expect(target.must_change_password).toBe(true);
      expect(await compare(temporary_password, target.password_hash)).toBe(true);
    });
  });

  describe('delete', () => {
    it('refuses deleting yourself and the last active ADMIN', async () => {
      users.findAll.mockResolvedValue([actorAdmin()]);
      users.findOne.mockResolvedValueOnce(actorAdmin());
      expect(await rpcErrorOf(service.delete({ actor_user_id: ACTOR, employee_id: 'e-actor' }))).toMatchObject({ status_code: 403 });

      const lastAdmin = fakeUser({ role: 'ADMIN' });
      users.findAll.mockResolvedValue([lastAdmin]);
      users.findOne.mockResolvedValueOnce(lastAdmin);
      expect(await rpcErrorOf(service.delete({ actor_user_id: ACTOR, employee_id: 'e-target' }))).toMatchObject({ status_code: 409 });
      expect(lastAdmin.destroy).not.toHaveBeenCalled();
    });

    it('soft-deletes an ordinary login', async () => {
      const target = fakeUser({});
      users.findAll.mockResolvedValue([actorAdmin()]);
      users.findOne.mockResolvedValue(target);
      expect(await service.delete({ actor_user_id: ACTOR, employee_id: 'e-target' })).toEqual({ deleted: true });
      expect(target.destroy).toHaveBeenCalled();
    });
  });
});
