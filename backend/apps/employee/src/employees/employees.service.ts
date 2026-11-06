import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError } from 'sequelize';
import type { Transaction, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { normalizeEmail, rpcError } from '@app/shared';
import type {
  CreateEmployeeRequest,
  DeleteEmployeeRequest,
  EmployeeChanges,
  EmployeeSummary,
  FindEmployeeIdsRequest,
  FindEmployeesByIdsRequest,
  EmployeeListResult,
  EmployeeRecord,
  FindEmployeeRequest,
  ListEmployeesRequest,
  UpdateEmployeeRequest,
  UpdateEmployeeResult,
} from '@app/shared';
import type { EmployeeStatus } from '@app/shared';
import { Department } from '../departments/department.model.js';
import { EmployeeCodeService } from './employee-code.service.js';
import { Employee } from './employee.model.js';
import type { EmployeeAttributes } from './employee.model.js';

const EMAIL_TAKEN = 'This email is already used by another employee';
const NOT_FOUND = 'Employee not found';

/** The fields an update may change, in a fixed order. */
const CHANGEABLE_FIELDS = ['full_name', 'email', 'phone', 'position', 'department_id', 'hire_date', 'status'] as const;
type ChangeableField = (typeof CHANGEABLE_FIELDS)[number];

function setChange<K extends ChangeableField>(target: EmployeeChanges, key: K, value: EmployeeChanges[K]): void {
  target[key] = value;
}

/** Escapes LIKE wildcards so a search for "50%" matches the text "50%". */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(Employee) private readonly employees: typeof Employee,
    @InjectModel(Department) private readonly departments: typeof Department,
    private readonly codes: EmployeeCodeService,
  ) {}

  /** Creates the employee with the next EMP-xxxx code. The login is created by the auth service. */
  async create({ profile, actor_employee_id }: CreateEmployeeRequest): Promise<EmployeeRecord> {
    const email = normalizeEmail(profile.email);
    const id = await this.withUniqueEmail(() =>
      this.sequelize.transaction(async (transaction) => {
        await this.assertDepartmentExists(profile.department_id, transaction);
        await this.assertEmailFree(email, null, transaction);
        // The code counter is locked until this transaction ends: concurrent creates get consecutive codes.
        const employee = await this.employees.create(
          {
            ...profile,
            email,
            employee_code: await this.codes.next(transaction),
            created_by: actor_employee_id,
            updated_by: actor_employee_id,
          },
          { transaction },
        );
        return employee.id;
      }),
    );
    return this.findOne({ id });
  }

  async list({ page, limit, search, department_id, status }: ListEmployeesRequest): Promise<EmployeeListResult> {
    const { rows, count } = await this.employees.findAndCountAll({
      where: filterOf(search, department_id, status),
      // A department deleted later still shows its name.
      include: [{ model: Department, paranoid: false }],
      // Newest first; id breaks ties so pages never overlap.
      order: [
        ['created_at', 'DESC'],
        ['id', 'ASC'],
      ],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    return { items: rows.map(toEmployeeRecord), total: count };
  }

  async findOne({ id }: FindEmployeeRequest): Promise<EmployeeRecord> {
    const employee = await this.employees.findByPk(id, { include: [{ model: Department, paranoid: false }] });
    if (!employee) throw rpcError(HttpStatus.NOT_FOUND, NOT_FOUND);
    return toEmployeeRecord(employee);
  }

  /**
   * Applies only the fields that actually change and returns their old values,
   * so the gateway can undo the update if the account update fails afterwards.
   */
  async update({ id, changes, actor_employee_id }: UpdateEmployeeRequest): Promise<UpdateEmployeeResult> {
    const result = await this.withUniqueEmail(() =>
      this.sequelize.transaction(async (transaction) => {
        const employee = await this.employees.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!employee) throw rpcError(HttpStatus.NOT_FOUND, NOT_FOUND);

        const requested: EmployeeChanges = { ...changes };
        if (requested.email !== undefined) requested.email = normalizeEmail(requested.email);

        const previous: EmployeeChanges = {};
        const actual: EmployeeChanges = {};
        for (const field of CHANGEABLE_FIELDS) {
          const next = requested[field];
          if (next !== undefined && next !== employee[field]) {
            setChange(previous, field, employee[field]);
            setChange(actual, field, next);
          }
        }

        const previousUpdatedBy = employee.updated_by;
        if (Object.keys(actual).length > 0) {
          if (actual.email !== undefined) await this.assertEmailFree(actual.email, id, transaction);
          if (actual.department_id !== undefined) await this.assertDepartmentExists(actual.department_id, transaction);
          await employee.update({ ...actual, updated_by: actor_employee_id }, { transaction });
        }
        return { previous, previous_updated_by: previousUpdatedBy };
      }),
    );
    return { employee: await this.findOne({ id }), ...result };
  }

  /**
   * Ids matching HR's attendance filters. Deleted employees are included: their
   * attendance stays as history and HR may still look for it.
   */
  async findIds({ search, department_id }: FindEmployeeIdsRequest): Promise<string[]> {
    const rows = await this.employees.findAll({
      attributes: ['id'],
      where: filterOf(search, department_id),
      paranoid: false,
    });
    return rows.map((row) => row.id);
  }

  /** Names for a page of attendance rows, in one query. Unknown ids are left out. */
  async findByIds({ ids }: FindEmployeesByIdsRequest): Promise<EmployeeSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.employees.findAll({
      where: { id: { [Op.in]: ids } },
      include: [{ model: Department, paranoid: false }],
      paranoid: false,
    });
    return rows.map((employee) => ({
      id: employee.id,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      department: { id: employee.department.id, name: employee.department.name },
      status: employee.status,
      is_deleted: employee.deleted_at !== null,
    }));
  }

  /** Soft delete: the row stays for history; normal queries no longer see it. */
  async delete({ id }: DeleteEmployeeRequest): Promise<{ id: string }> {
    const employee = await this.employees.findByPk(id);
    if (!employee) throw rpcError(HttpStatus.NOT_FOUND, NOT_FOUND);
    await employee.destroy();
    return { id };
  }

  private async assertDepartmentExists(departmentId: string, transaction: Transaction): Promise<void> {
    const department = await this.departments.findByPk(departmentId, { transaction });
    if (!department) throw rpcError(HttpStatus.BAD_REQUEST, 'department_id does not match any department');
  }

  /** Friendly check; the unique key (email, not_deleted) is the real guarantee under concurrency. */
  private async assertEmailFree(email: string, exceptId: string | null, transaction: Transaction): Promise<void> {
    const owner = await this.employees.findOne({ where: { email }, transaction });
    if (owner && owner.id !== exceptId) throw rpcError(HttpStatus.CONFLICT, EMAIL_TAKEN);
  }

  /** A duplicate that slipped past assertEmailFree (simultaneous requests) is still a 409. */
  private async withUniqueEmail<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error: unknown) {
      if (error instanceof UniqueConstraintError) throw rpcError(HttpStatus.CONFLICT, EMAIL_TAKEN);
      throw error;
    }
  }
}

/** Shared by the employee list and the attendance filters: same search rules everywhere. */
function filterOf(search?: string, departmentId?: string, status?: EmployeeStatus): WhereOptions<EmployeeAttributes> {
  const conditions: WhereOptions<EmployeeAttributes>[] = [];
  if (status) conditions.push({ status });
  if (departmentId) conditions.push({ department_id: departmentId });
  if (search?.trim()) {
    const pattern = `%${escapeLike(search.trim())}%`;
    conditions.push({
      [Op.or]: [
        { full_name: { [Op.like]: pattern } },
        { employee_code: { [Op.like]: pattern } },
        { email: { [Op.like]: pattern } },
      ],
    });
  }
  return { [Op.and]: conditions };
}

function toEmployeeRecord(employee: Employee): EmployeeRecord {
  return {
    id: employee.id,
    employee_code: employee.employee_code,
    full_name: employee.full_name,
    email: employee.email,
    phone: employee.phone,
    position: employee.position,
    department: { id: employee.department.id, name: employee.department.name },
    hire_date: employee.hire_date,
    status: employee.status,
    created_by: employee.created_by,
    updated_by: employee.updated_by,
    created_at: employee.created_at.toISOString(),
    updated_at: employee.updated_at.toISOString(),
  };
}
