import { HttpException, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { AUTH_PATTERNS, EMPLOYEE_PATTERNS, SERVICE_CLIENTS } from '@app/shared';
import type { EmployeeAccount, EmployeeRecord, JwtPayload } from '@app/shared';
import { EmployeesService } from './employees.service.js';

const HR: JwtPayload = { sub: 'u-hr', employee_id: 'e-hr', role: 'ADMIN', must_change_password: false };

const EMPLOYEE: EmployeeRecord = {
  id: 'e-1',
  employee_code: 'EMP-0042',
  full_name: 'Budi Santoso',
  email: 'budi@dexa.com',
  phone: null,
  position: 'Developer',
  department: { id: 'd-1', name: 'Engineering' },
  hire_date: '2026-01-05',
  status: 'ACTIVE',
  created_by: 'e-hr',
  updated_by: 'e-hr',
  created_at: '2026-11-06T07:00:00.000Z',
  updated_at: '2026-11-06T07:00:00.000Z',
};

const ACCOUNT: EmployeeAccount = {
  user_id: 'u-1',
  employee_id: 'e-1',
  email: 'budi@dexa.com',
  role: 'EMPLOYEE',
  is_active: true,
  must_change_password: true,
  last_login_at: null,
};

type Send = (pattern: string, payload: unknown) => Observable<unknown>;
const refused = (status_code: number, message: string) => throwError(() => ({ status_code, message }));

describe('EmployeesService (gateway orchestration)', () => {
  const employeeSend = vi.fn<Send>();
  const authSend = vi.fn<Send>();
  let service: EmployeesService;

  beforeEach(async () => {
    employeeSend.mockReset();
    authSend.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: SERVICE_CLIENTS.employee, useValue: { send: employeeSend } },
        { provide: SERVICE_CLIENTS.auth, useValue: { send: authSend } },
      ],
    }).compile();
    service = module.get(EmployeesService);
  });

  it('list merges logins with ONE batch call and computes the pages', async () => {
    employeeSend.mockReturnValue(of({ items: [EMPLOYEE, { ...EMPLOYEE, id: 'e-2' }], total: 23 }));
    authSend.mockReturnValue(of([ACCOUNT]));

    const result = await service.list({ page: 2, limit: 10 });

    expect(authSend).toHaveBeenCalledTimes(1);
    expect(authSend).toHaveBeenCalledWith(AUTH_PATTERNS.FIND_ACCOUNTS, { employee_ids: ['e-1', 'e-2'] });
    expect(result.items[0].account).toEqual(ACCOUNT);
    expect(result.items[1].account).toBeNull(); // no login: shown so HR can spot it
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 23, total_pages: 3 });
  });

  describe('create', () => {
    const dto = { full_name: 'Budi Santoso', email: 'budi@dexa.com', position: 'Developer', department_id: 'd-1', hire_date: '2026-01-05' };

    it('creates the employee, then the login, and returns the temporary password', async () => {
      employeeSend.mockReturnValue(of(EMPLOYEE));
      authSend.mockReturnValue(of({ account: ACCOUNT, temporary_password: 'Tmp9xKq2mWp4Rz' }));

      const result = await service.create(dto, HR);

      expect(employeeSend).toHaveBeenCalledWith(EMPLOYEE_PATTERNS.CREATE, expect.objectContaining({ actor_employee_id: 'e-hr' }));
      expect(authSend).toHaveBeenCalledWith(AUTH_PATTERNS.CREATE_USER, { employee_id: 'e-1', email: 'budi@dexa.com', role: 'EMPLOYEE' });
      expect(result).toEqual({ employee: { ...EMPLOYEE, account: ACCOUNT }, temporary_password: 'Tmp9xKq2mWp4Rz' });
    });

    it('undoes the employee when the login cannot be created, then reports the error', async () => {
      employeeSend.mockImplementation((pattern) => (pattern === EMPLOYEE_PATTERNS.CREATE ? of(EMPLOYEE) : of({ id: 'e-1' })));
      authSend.mockReturnValue(refused(409, 'This email is already used by another login'));

      await expect(service.create(dto, HR)).rejects.toMatchObject({ status: 409, message: 'This email is already used by another login' });
      expect(employeeSend).toHaveBeenCalledWith(EMPLOYEE_PATTERNS.DELETE, { id: 'e-1' });
    });

    it('logs MANUAL FIX NEEDED when the undo itself fails, and still reports the original error', async () => {
      const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      employeeSend.mockImplementation((pattern) =>
        pattern === EMPLOYEE_PATTERNS.CREATE ? of(EMPLOYEE) : throwError(() => new Error('employee service down')),
      );
      authSend.mockReturnValue(refused(409, 'This email is already used by another login'));

      await expect(service.create(dto, HR)).rejects.toMatchObject({ status: 409 });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('MANUAL FIX NEEDED'), expect.anything());
      logError.mockRestore();
    });
  });

  describe('update', () => {
    it('sends HR fields to the employee service and email/role/status to the login', async () => {
      employeeSend.mockReturnValue(of({ employee: EMPLOYEE, previous: { email: 'old@dexa.com' }, previous_updated_by: 'e-hr' }));
      authSend.mockReturnValue(of({ account: ACCOUNT, temporary_password: null }));

      await service.update('e-1', { email: 'budi@dexa.com', status: 'INACTIVE', role: 'ADMIN' }, HR);

      expect(employeeSend).toHaveBeenCalledWith(EMPLOYEE_PATTERNS.UPDATE, {
        id: 'e-1',
        changes: { email: 'budi@dexa.com', status: 'INACTIVE' },
        actor_employee_id: 'e-hr',
      });
      expect(authSend).toHaveBeenCalledWith(AUTH_PATTERNS.UPDATE_ACCOUNT, {
        actor_user_id: 'u-hr',
        employee_id: 'e-1',
        email: 'budi@dexa.com',
        role: 'ADMIN',
        is_active: false,
      });
    });

    it('restores the old HR values when the login update is refused (e.g. last admin)', async () => {
      employeeSend.mockReturnValue(
        of({ employee: { ...EMPLOYEE, status: 'INACTIVE' }, previous: { status: 'ACTIVE' }, previous_updated_by: 'e-seed' }),
      );
      authSend.mockReturnValue(refused(409, 'This is the last active HR admin. Make someone else HR admin first.'));

      await expect(service.update('e-1', { status: 'INACTIVE' }, HR)).rejects.toMatchObject({ status: 409 });
      expect(employeeSend).toHaveBeenLastCalledWith(EMPLOYEE_PATTERNS.UPDATE, {
        id: 'e-1',
        changes: { status: 'ACTIVE' },
        actor_employee_id: 'e-seed',
      });
    });

    it('returns the temporary password when the employee is reactivated', async () => {
      employeeSend.mockReturnValue(of({ employee: EMPLOYEE, previous: { status: 'INACTIVE' }, previous_updated_by: 'e-hr' }));
      authSend.mockReturnValue(of({ account: ACCOUNT, temporary_password: 'Nw7pQ2xKmT9aRd' }));
      expect((await service.update('e-1', { status: 'ACTIVE' }, HR)).temporary_password).toBe('Nw7pQ2xKmT9aRd');
    });

    it('rejects an empty update', async () => {
      await expect(service.update('e-1', {}, HR)).rejects.toBeInstanceOf(HttpException);
      expect(employeeSend).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('removes the login first, then the employee', async () => {
      employeeSend.mockReturnValue(of(EMPLOYEE));
      authSend.mockReturnValue(of({ deleted: true }));

      await service.delete('e-1', HR);

      const authOrder = authSend.mock.invocationCallOrder[0];
      const employeeDeleteIndex = employeeSend.mock.calls.findIndex(([pattern]) => pattern === EMPLOYEE_PATTERNS.DELETE);
      expect(authOrder).toBeLessThan(employeeSend.mock.invocationCallOrder[employeeDeleteIndex]);
    });

    it('restores the login when deleting the employee fails', async () => {
      employeeSend.mockImplementation((pattern) =>
        pattern === EMPLOYEE_PATTERNS.DELETE ? refused(404, 'Employee not found') : of(EMPLOYEE),
      );
      authSend.mockImplementation((pattern) => (pattern === AUTH_PATTERNS.DELETE_USER ? of({ deleted: true }) : of({ restored: true })));

      await expect(service.delete('e-1', HR)).rejects.toMatchObject({ status: 404 });
      expect(authSend).toHaveBeenLastCalledWith(AUTH_PATTERNS.RESTORE_USER, { employee_id: 'e-1' });
    });
  });
});
