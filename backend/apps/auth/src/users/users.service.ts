import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError } from 'sequelize';
import type { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { normalizeEmail, rpcError } from '@app/shared';
import type {
  AccountActionRequest,
  CreateUserRequest,
  CreateUserResult,
  EmployeeAccount,
  FindAccountsRequest,
  RestoreUserRequest,
  TemporaryPasswordResult,
  UpdateAccountRequest,
  UpdateAccountResult,
} from '@app/shared';
import { PasswordService } from '../passwords/password.service.js';
import { generateTemporaryPassword } from '../passwords/temporary-password.js';
import { User } from './user.model.js';

const EMAIL_TAKEN = 'This email is already used by another login';
const NOT_FOUND = 'This employee has no login account';
const LAST_ADMIN = 'This is the last active HR admin. Make someone else HR admin first.';

/**
 * Login accounts of employees, managed through the gateway's employee endpoints.
 * Enforces the role guardrails (docs/database-design.md → Role management guardrails):
 * nobody changes their own access, and the last active ADMIN can't be removed.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(User) private readonly users: typeof User,
    private readonly passwords: PasswordService,
  ) {}

  /** Creates the login for a new employee with a generated temporary password. */
  async create({ employee_id, email, role }: CreateUserRequest): Promise<CreateUserResult> {
    const normalizedEmail = normalizeEmail(email);
    const temporaryPassword = generateTemporaryPassword();
    const user = await this.withUniqueEmail(async () => {
      const existing = await this.users.findOne({
        where: { [Op.or]: [{ email: normalizedEmail }, { employee_id }] },
      });
      if (existing) {
        throw rpcError(
          HttpStatus.CONFLICT,
          existing.employee_id === employee_id ? 'This employee already has a login account' : EMAIL_TAKEN,
        );
      }
      return this.users.create({
        employee_id,
        email: normalizedEmail,
        role,
        password_hash: await this.passwords.hash(temporaryPassword),
        must_change_password: true,
      });
    });
    return { account: toEmployeeAccount(user), temporary_password: temporaryPassword };
  }

  async findAccounts({ employee_ids }: FindAccountsRequest): Promise<EmployeeAccount[]> {
    if (employee_ids.length === 0) return [];
    const users = await this.users.findAll({ where: { employee_id: { [Op.in]: employee_ids } } });
    return users.map(toEmployeeAccount);
  }

  /**
   * Changes email, role and/or active flag. Reactivating an account issues a
   * new temporary password (the person may have been away for a long time).
   */
  async updateAccount(request: UpdateAccountRequest): Promise<UpdateAccountResult> {
    return this.withUniqueEmail(() =>
      this.sequelize.transaction(async (transaction) => {
        const touchesAccess = request.role !== undefined || request.is_active !== undefined;
        // Lock the admin rows before the target row: concurrent role changes then lock in the
        // same order and wait for each other instead of deadlocking.
        const admins = touchesAccess ? await this.lockActiveAdmins(transaction) : [];
        const user = await this.findByEmployee(request.employee_id, transaction);

        const roleChanges = request.role !== undefined && request.role !== user.role;
        const activeChanges = request.is_active !== undefined && request.is_active !== user.is_active;
        if ((roleChanges || activeChanges) && request.actor_user_id === user.id) {
          throw rpcError(HttpStatus.FORBIDDEN, 'You cannot change your own role or deactivate your own account');
        }
        const removesAdmin =
          user.role === 'ADMIN' && user.is_active && ((roleChanges && request.role !== 'ADMIN') || request.is_active === false);
        if (removesAdmin) assertNotLastAdmin(admins, user.id);

        const changes: Partial<Pick<User, 'email' | 'role' | 'is_active' | 'password_hash' | 'must_change_password'>> = {};
        if (request.email !== undefined && normalizeEmail(request.email) !== user.email) {
          changes.email = normalizeEmail(request.email);
        }
        if (roleChanges && request.role !== undefined) changes.role = request.role;

        let temporaryPassword: string | null = null;
        if (activeChanges && request.is_active !== undefined) {
          changes.is_active = request.is_active;
          if (request.is_active) {
            temporaryPassword = generateTemporaryPassword();
            changes.password_hash = await this.passwords.hash(temporaryPassword);
            changes.must_change_password = true;
          }
        }

        if (Object.keys(changes).length > 0) await user.update(changes, { transaction });
        return { account: toEmployeeAccount(user), temporary_password: temporaryPassword };
      }),
    );
  }

  /** HR resets someone else's password: a new temporary one they must change at login. */
  async resetPassword({ actor_user_id, employee_id }: AccountActionRequest): Promise<TemporaryPasswordResult> {
    const user = await this.findByEmployee(employee_id);
    if (user.id === actor_user_id) {
      throw rpcError(HttpStatus.FORBIDDEN, 'Use "Change password" for your own account');
    }
    if (!user.is_active) {
      throw rpcError(HttpStatus.CONFLICT, 'This account is deactivated. Reactivate the employee instead.');
    }
    const temporaryPassword = generateTemporaryPassword();
    await user.update({ password_hash: await this.passwords.hash(temporaryPassword), must_change_password: true });
    return { temporary_password: temporaryPassword };
  }

  /** Soft-deletes the login. Runs before the employee is deleted, so access ends first. */
  async delete({ actor_user_id, employee_id }: AccountActionRequest): Promise<{ deleted: boolean }> {
    return this.sequelize.transaction(async (transaction) => {
      const admins = await this.lockActiveAdmins(transaction);
      const user = await this.users.findOne({ where: { employee_id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!user) return { deleted: false }; // no login to remove
      if (user.id === actor_user_id) throw rpcError(HttpStatus.FORBIDDEN, 'You cannot delete your own account');
      if (user.role === 'ADMIN' && user.is_active) assertNotLastAdmin(admins, user.id);
      await user.destroy({ transaction });
      return { deleted: true };
    });
  }

  /** Undo of delete(), used by the gateway when deleting the employee then fails. */
  async restore({ employee_id }: RestoreUserRequest): Promise<{ restored: boolean }> {
    const user = await this.users.findOne({
      where: { employee_id, deleted_at: { [Op.ne]: null } },
      paranoid: false,
      order: [['deleted_at', 'DESC']],
    });
    if (!user) return { restored: false };
    await user.restore();
    return { restored: true };
  }

  /** Locks every active ADMIN row until the transaction ends (see updateAccount). */
  private lockActiveAdmins(transaction: Transaction): Promise<User[]> {
    return this.users.findAll({ where: { role: 'ADMIN', is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
  }

  private async findByEmployee(employeeId: string, transaction?: Transaction): Promise<User> {
    const user = await this.users.findOne({
      where: { employee_id: employeeId },
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    if (!user) throw rpcError(HttpStatus.NOT_FOUND, NOT_FOUND);
    return user;
  }

  /** The unique keys are the real guarantee; a duplicate that slipped past the check is still a 409. */
  private async withUniqueEmail<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error: unknown) {
      if (error instanceof UniqueConstraintError) throw rpcError(HttpStatus.CONFLICT, EMAIL_TAKEN);
      throw error;
    }
  }
}

function assertNotLastAdmin(lockedAdmins: User[], targetUserId: string): void {
  if (!lockedAdmins.some((admin) => admin.id !== targetUserId)) {
    throw rpcError(HttpStatus.CONFLICT, LAST_ADMIN);
  }
}

function toEmployeeAccount(user: User): EmployeeAccount {
  return {
    user_id: user.id,
    employee_id: user.employee_id,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    must_change_password: user.must_change_password,
    last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null,
  };
}
