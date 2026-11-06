import type {
  CreateEmployeeRequest,
  CreatedEmployee,
  Department,
  Employee,
  EmployeeList,
  ListEmployeesQuery,
  TemporaryPassword,
  UpdateEmployeeRequest,
  UpdatedEmployee,
} from '../types/employee'
import {
  isCreatedEmployee,
  isDepartmentList,
  isEmployee,
  isEmployeeList,
  isTemporaryPassword,
  isUpdatedEmployee,
} from '../types/employee'
import { parseWith, request } from './http'

// Endpoints: backend/docs/api/employees.md (HR only, except getMyProfile).

const employeePath = (id: string) => `/employees/${encodeURIComponent(id)}`

export function listDepartments(): Promise<Department[]> {
  return request({ method: 'GET', url: '/departments' }, parseWith(isDepartmentList, 'department list'))
}

export function listEmployees(query: ListEmployeesQuery): Promise<EmployeeList> {
  // Leave out empty filters so the URL stays clean (axios skips undefined params).
  const params = {
    page: query.page,
    limit: query.limit,
    search: query.search?.trim() || undefined,
    department_id: query.department_id || undefined,
    status: query.status || undefined,
  }
  return request({ method: 'GET', url: '/employees', params }, parseWith(isEmployeeList, 'employee list'))
}

export function getEmployee(id: string): Promise<Employee> {
  return request({ method: 'GET', url: employeePath(id) }, parseWith(isEmployee, 'employee'))
}

/** Any logged-in user: their own employee profile. */
export function getMyProfile(): Promise<Employee> {
  return request({ method: 'GET', url: '/employees/me' }, parseWith(isEmployee, 'profile'))
}

export function createEmployee(body: CreateEmployeeRequest): Promise<CreatedEmployee> {
  return request({ method: 'POST', url: '/employees', data: body }, parseWith(isCreatedEmployee, 'new employee'))
}

export function updateEmployee(id: string, body: UpdateEmployeeRequest): Promise<UpdatedEmployee> {
  return request({ method: 'PATCH', url: employeePath(id), data: body }, parseWith(isUpdatedEmployee, 'employee'))
}

export function resetEmployeePassword(id: string): Promise<TemporaryPassword> {
  return request(
    { method: 'POST', url: `${employeePath(id)}/reset-password` },
    parseWith(isTemporaryPassword, 'temporary password'),
  )
}

/** Soft delete, for records created by mistake. The response has no data. */
export function deleteEmployee(id: string): Promise<void> {
  return request({ method: 'DELETE', url: employeePath(id) }, () => undefined)
}
