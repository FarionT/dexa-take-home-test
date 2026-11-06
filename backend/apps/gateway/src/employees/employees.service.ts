import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { AUTH_PATTERNS, EMPLOYEE_PATTERNS, SERVICE_CLIENTS } from '@app/shared';
import type {
  AccountActionRequest,
  CreateEmployeeRequest,
  CreateUserRequest,
  CreateUserResult,
  DeleteEmployeeRequest,
  EmployeeAccount,
  EmployeeChanges,
  EmployeeListResult,
  EmployeeRecord,
  FindAccountsRequest,
  FindEmployeeRequest,
  JwtPayload,
  ListEmployeesRequest,
  RestoreUserRequest,
  TemporaryPasswordResult,
  UpdateAccountRequest,
  UpdateAccountResult,
  UpdateEmployeeRequest,
  UpdateEmployeeResult,
} from '@app/shared';
import { sendToService } from '../clients/rpc.js';
import type { CreateEmployeeDto } from './dto/create-employee.dto.js';
import type { ListEmployeesQueryDto } from './dto/list-employees.query.js';
import type { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import type { CreatedEmployeeView, EmployeeListView, EmployeeView, UpdatedEmployeeView } from './employees.types.js';

/**
 * Employee endpoints: HR data lives in the employee service, the login in the
 * auth service. Steps that touch both run in a fixed order with an undo step,
 * because the two databases share no transaction (docs/database-design.md →
 * Cross-database rules):
 *   create: employee → login        (login fails  → delete the new employee)
 *   update: employee → login        (login refused → restore the old employee values)
 *   delete: login → employee        (employee fails → restore the login; access ends first)
 */
@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @Inject(SERVICE_CLIENTS.employee) private readonly employeeClient: ClientProxy,
    @Inject(SERVICE_CLIENTS.auth) private readonly authClient: ClientProxy,
  ) {}

  async list(query: ListEmployeesQueryDto): Promise<EmployeeListView> {
    const { page, limit } = query;
    const result = await sendToService<EmployeeListResult, ListEmployeesRequest>(
      this.employeeClient,
      EMPLOYEE_PATTERNS.LIST,
      { page, limit, search: query.search || undefined, department_id: query.department_id, status: query.status },
    );
    // One batch call for every row's login, not one call per row.
    const accounts = await this.accountsFor(result.items.map((employee) => employee.id));
    return {
      items: result.items.map((employee) => withAccount(employee, accounts)),
      meta: { page, limit, total: result.total, total_pages: Math.ceil(result.total / limit) },
    };
  }

  async findOne(id: string): Promise<EmployeeView> {
    const employee = await this.findEmployee(id);
    return withAccount(employee, await this.accountsFor([id]));
  }

  async create(dto: CreateEmployeeDto, actor: JwtPayload): Promise<CreatedEmployeeView> {
    const employee = await sendToService<EmployeeRecord, CreateEmployeeRequest>(
      this.employeeClient,
      EMPLOYEE_PATTERNS.CREATE,
      {
        profile: {
          full_name: dto.full_name,
          email: dto.email,
          phone: dto.phone ?? null,
          position: dto.position,
          department_id: dto.department_id,
          hire_date: dto.hire_date,
        },
        actor_employee_id: actor.employee_id,
      },
    );

    let login: CreateUserResult;
    try {
      login = await sendToService<CreateUserResult, CreateUserRequest>(this.authClient, AUTH_PATTERNS.CREATE_USER, {
        employee_id: employee.id,
        email: employee.email,
        role: dto.role ?? 'EMPLOYEE',
      });
    } catch (error: unknown) {
      // Never leave an employee without a login: undo the employee (soft delete frees its email again).
      await this.undo(`delete half-created employee ${employee.id}`, () =>
        sendToService<{ id: string }, DeleteEmployeeRequest>(this.employeeClient, EMPLOYEE_PATTERNS.DELETE, {
          id: employee.id,
        }),
      );
      throw error;
    }

    return { employee: { ...employee, account: login.account }, temporary_password: login.temporary_password };
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: JwtPayload): Promise<UpdatedEmployeeView> {
    const changes = employeeChangesOf(dto);
    const accountChanges = accountChangesOf(dto);
    if (Object.keys(changes).length === 0 && Object.keys(accountChanges).length === 0) {
      throw new BadRequestException('Nothing to update: send at least one field');
    }

    // 1. HR data (checks: employee exists, email free, department exists).
    const updated =
      Object.keys(changes).length > 0
        ? await sendToService<UpdateEmployeeResult, UpdateEmployeeRequest>(this.employeeClient, EMPLOYEE_PATTERNS.UPDATE, {
            id,
            changes,
            actor_employee_id: actor.employee_id,
          })
        : null;
    if (!updated) await this.findEmployee(id); // a role-only change still needs a 404 for unknown ids

    // 2. Login (checks: role guardrails, email free). If refused, put the HR data back.
    let account: UpdateAccountResult | null = null;
    if (Object.keys(accountChanges).length > 0) {
      try {
        account = await sendToService<UpdateAccountResult, UpdateAccountRequest>(
          this.authClient,
          AUTH_PATTERNS.UPDATE_ACCOUNT,
          { actor_user_id: actor.sub, employee_id: id, ...accountChanges },
        );
      } catch (error: unknown) {
        if (updated && Object.keys(updated.previous).length > 0) {
          await this.undo(`restore employee ${id} after the login update failed`, () =>
            sendToService<UpdateEmployeeResult, UpdateEmployeeRequest>(this.employeeClient, EMPLOYEE_PATTERNS.UPDATE, {
              id,
              changes: updated.previous,
              actor_employee_id: updated.previous_updated_by,
            }),
          );
        }
        throw error;
      }
    }

    const employee = updated?.employee ?? (await this.findEmployee(id));
    const login = account?.account ?? (await this.accountsFor([id])).get(id) ?? null;
    return { employee: { ...employee, account: login }, temporary_password: account?.temporary_password ?? null };
  }

  async resetPassword(id: string, actor: JwtPayload): Promise<TemporaryPasswordResult> {
    await this.findEmployee(id);
    return sendToService<TemporaryPasswordResult, AccountActionRequest>(this.authClient, AUTH_PATTERNS.RESET_PASSWORD, {
      actor_user_id: actor.sub,
      employee_id: id,
    });
  }

  /** Soft-deletes the login first (access ends, guardrails apply), then the employee. */
  async delete(id: string, actor: JwtPayload): Promise<void> {
    await this.findEmployee(id);
    const login = await sendToService<{ deleted: boolean }, AccountActionRequest>(
      this.authClient,
      AUTH_PATTERNS.DELETE_USER,
      { actor_user_id: actor.sub, employee_id: id },
    );
    try {
      await sendToService<{ id: string }, DeleteEmployeeRequest>(this.employeeClient, EMPLOYEE_PATTERNS.DELETE, { id });
    } catch (error: unknown) {
      if (login.deleted) {
        await this.undo(`restore the login of employee ${id}`, () =>
          sendToService<{ restored: boolean }, RestoreUserRequest>(this.authClient, AUTH_PATTERNS.RESTORE_USER, {
            employee_id: id,
          }),
        );
      }
      throw error;
    }
  }

  private findEmployee(id: string): Promise<EmployeeRecord> {
    return sendToService<EmployeeRecord, FindEmployeeRequest>(this.employeeClient, EMPLOYEE_PATTERNS.FIND_ONE, { id });
  }

  private async accountsFor(employeeIds: string[]): Promise<Map<string, EmployeeAccount>> {
    if (employeeIds.length === 0) return new Map();
    const accounts = await sendToService<EmployeeAccount[], FindAccountsRequest>(
      this.authClient,
      AUTH_PATTERNS.FIND_ACCOUNTS,
      { employee_ids: employeeIds },
    );
    return new Map(accounts.map((account) => [account.employee_id, account]));
  }

  /**
   * Runs an undo step. If the undo itself fails, the two databases disagree:
   * log loudly with the ids for a manual fix, and let the caller report the
   * original error to the user.
   */
  private async undo(description: string, step: () => Promise<unknown>): Promise<void> {
    try {
      await step();
    } catch (error: unknown) {
      this.logger.error(
        `MANUAL FIX NEEDED: could not ${description}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );
    }
  }
}

function withAccount(employee: EmployeeRecord, accounts: Map<string, EmployeeAccount>): EmployeeView {
  return { ...employee, account: accounts.get(employee.id) ?? null };
}

/** The HR-data part of an update request (only fields that were sent). */
function employeeChangesOf(dto: UpdateEmployeeDto): EmployeeChanges {
  const changes: EmployeeChanges = {};
  if (dto.full_name !== undefined) changes.full_name = dto.full_name;
  if (dto.email !== undefined) changes.email = dto.email;
  if (dto.phone !== undefined) changes.phone = dto.phone;
  if (dto.position !== undefined) changes.position = dto.position;
  if (dto.department_id !== undefined) changes.department_id = dto.department_id;
  if (dto.hire_date !== undefined) changes.hire_date = dto.hire_date;
  if (dto.status !== undefined) changes.status = dto.status;
  return changes;
}

/** The login part: email is kept equal in both services; status maps to is_active. */
function accountChangesOf(dto: UpdateEmployeeDto): Pick<UpdateAccountRequest, 'email' | 'role' | 'is_active'> {
  const changes: Pick<UpdateAccountRequest, 'email' | 'role' | 'is_active'> = {};
  if (dto.email !== undefined) changes.email = dto.email;
  if (dto.role !== undefined) changes.role = dto.role;
  if (dto.status !== undefined) changes.is_active = dto.status === 'ACTIVE';
  return changes;
}
