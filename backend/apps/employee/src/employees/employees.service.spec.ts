import { RpcException } from '@nestjs/microservices';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Department } from '../departments/department.model.js';
import { EmployeeCodeService } from './employee-code.service.js';
import { Employee } from './employee.model.js';
import { EmployeesService } from './employees.service.js';

const NOW = new Date('2026-11-06T07:00:00.000Z');

function fakeEmployee(overrides: Record<string, unknown> = {}) {
  const employee = {
    id: 'e-1',
    employee_code: 'EMP-0042',
    full_name: 'Budi Santoso',
    email: 'budi@dexa.com',
    phone: null,
    position: 'Developer',
    department_id: 'd-1',
    department: { id: 'd-1', name: 'Engineering' },
    hire_date: '2026-01-05',
    status: 'ACTIVE',
    deleted_at: null,
    created_by: 'e-hr',
    updated_by: 'e-hr',
    created_at: NOW,
    updated_at: NOW,
    update: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
  employee.update.mockImplementation((changes: Record<string, unknown>) => Object.assign(employee, changes));
  return employee;
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

describe('EmployeesService', () => {
  const employees = { findByPk: vi.fn(), findOne: vi.fn(), create: vi.fn(), findAndCountAll: vi.fn(), findAll: vi.fn() };
  const departments = { findByPk: vi.fn() };
  const codes = { next: vi.fn() };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const sequelize = { transaction: vi.fn((work: (t: typeof transaction) => unknown) => work(transaction)) };
  let service: EmployeesService;

  beforeEach(async () => {
    [...Object.values(employees), departments.findByPk, codes.next].forEach((fn) => fn.mockReset());
    const module = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: Sequelize, useValue: sequelize },
        { provide: getModelToken(Employee), useValue: employees },
        { provide: getModelToken(Department), useValue: departments },
        { provide: EmployeeCodeService, useValue: codes },
      ],
    }).compile();
    service = module.get(EmployeesService);
  });

  describe('create', () => {
    it('takes the code from the counter inside the transaction and records the creator', async () => {
      departments.findByPk.mockResolvedValue({ id: 'd-1' });
      employees.findOne.mockResolvedValue(null); // email free
      codes.next.mockResolvedValue('EMP-0043');
      employees.create.mockResolvedValue({ id: 'e-new' });
      employees.findByPk.mockResolvedValue(fakeEmployee({ id: 'e-new', employee_code: 'EMP-0043' }));

      const created = await service.create({
        profile: { full_name: 'Siti', email: ' Siti@Dexa.com ', phone: null, position: 'Analyst', department_id: 'd-1', hire_date: '2026-11-10' },
        actor_employee_id: 'e-hr',
      });

      expect(codes.next).toHaveBeenCalledWith(transaction);
      expect(employees.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'siti@dexa.com', employee_code: 'EMP-0043', created_by: 'e-hr', updated_by: 'e-hr' }),
        { transaction },
      );
      expect(created.employee_code).toBe('EMP-0043');
      expect(created.created_at).toBe(NOW.toISOString());
    });

    it('refuses an unknown department (400) and a used email (409)', async () => {
      const profile = { full_name: 'X', email: 'x@dexa.com', phone: null, position: 'P', department_id: 'd-x', hire_date: '2026-11-10' };
      departments.findByPk.mockResolvedValueOnce(null);
      expect(await rpcErrorOf(service.create({ profile, actor_employee_id: 'e-hr' }))).toMatchObject({ status_code: 400 });

      departments.findByPk.mockResolvedValueOnce({ id: 'd-x' });
      employees.findOne.mockResolvedValueOnce(fakeEmployee({ id: 'someone-else' }));
      expect(await rpcErrorOf(service.create({ profile, actor_employee_id: 'e-hr' }))).toEqual({
        status_code: 409,
        message: 'This email is already used by another employee',
      });
      expect(codes.next).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('applies only real changes and returns their old values for an undo', async () => {
      const employee = fakeEmployee();
      employees.findByPk.mockResolvedValue(employee);

      const result = await service.update({
        id: 'e-1',
        changes: { full_name: 'Budi S.', position: 'Developer', status: 'INACTIVE' }, // position unchanged
        actor_employee_id: 'e-hr2',
      });

      expect(employee.update).toHaveBeenCalledWith(
        { full_name: 'Budi S.', status: 'INACTIVE', updated_by: 'e-hr2' },
        { transaction },
      );
      expect(result.previous).toEqual({ full_name: 'Budi Santoso', status: 'ACTIVE' });
      expect(result.previous_updated_by).toBe('e-hr');
    });

    it('does not write when nothing actually changes', async () => {
      const employee = fakeEmployee();
      employees.findByPk.mockResolvedValue(employee);
      const result = await service.update({ id: 'e-1', changes: { email: 'BUDI@dexa.com' }, actor_employee_id: 'e-hr' });
      expect(employee.update).not.toHaveBeenCalled();
      expect(result.previous).toEqual({});
    });

    it('returns 404 for an unknown employee', async () => {
      employees.findByPk.mockResolvedValue(null);
      expect(await rpcErrorOf(service.update({ id: 'nope', changes: { full_name: 'X' }, actor_employee_id: 'e-hr' }))).toMatchObject({
        status_code: 404,
      });
    });
  });

  describe('attendance lookups', () => {
    it('findIds includes deleted employees and uses the same search as the list', async () => {
      employees.findAll.mockResolvedValue([{ id: 'e-1' }, { id: 'e-2' }]);

      expect(await service.findIds({ search: ' 50% ', department_id: 'd-1' })).toEqual(['e-1', 'e-2']);

      const options = employees.findAll.mock.calls[0][0];
      expect(options).toMatchObject({ attributes: ['id'], paranoid: false });
      // Trimmed, and the % is matched literally (escaped).
      expect(options.where[Op.and]).toEqual([
        { department_id: 'd-1' },
        { [Op.or]: expect.arrayContaining([{ full_name: { [Op.like]: '%50\\%%' } }]) },
      ]);
    });

    it('findByIds returns summaries, marking deleted employees', async () => {
      employees.findAll.mockResolvedValue([fakeEmployee(), fakeEmployee({ id: 'e-2', deleted_at: NOW })]);

      const summaries = await service.findByIds({ ids: ['e-1', 'e-2'] });

      expect(employees.findAll).toHaveBeenCalledWith(expect.objectContaining({ paranoid: false }));
      expect(summaries).toEqual([
        { id: 'e-1', employee_code: 'EMP-0042', full_name: 'Budi Santoso', department: { id: 'd-1', name: 'Engineering' }, status: 'ACTIVE', is_deleted: false },
        expect.objectContaining({ id: 'e-2', is_deleted: true }),
      ]);
    });

    it('findByIds with no ids does not query', async () => {
      expect(await service.findByIds({ ids: [] })).toEqual([]);
      expect(employees.findAll).not.toHaveBeenCalled();
    });
  });

  it('delete is a soft delete (destroy on a paranoid model)', async () => {
    const employee = fakeEmployee();
    employees.findByPk.mockResolvedValue(employee);
    await service.delete({ id: 'e-1' });
    expect(employee.destroy).toHaveBeenCalledWith();
  });
});
