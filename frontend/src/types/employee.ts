import { isRecord } from './api'
import type { Role } from './auth'

// Mirrors backend/docs/api/employees.md (snake_case data fields, as in the API).

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE'

export interface Department {
  id: string
  name: string
}

/** The login side of an employee. Never contains a password. */
export interface EmployeeAccount {
  user_id: string
  employee_id: string
  email: string
  role: Role
  is_active: boolean
  must_change_password: boolean
  last_login_at: string | null
}

export interface Employee {
  id: string
  employee_code: string
  full_name: string
  email: string
  phone: string | null
  position: string
  department: Department
  /** YYYY-MM-DD */
  hire_date: string
  status: EmployeeStatus
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  account: EmployeeAccount | null
}

export interface EmployeeList {
  items: Employee[]
  meta: { page: number; limit: number; total: number; total_pages: number }
}

export interface ListEmployeesQuery {
  page?: number
  limit?: number
  search?: string
  department_id?: string
  status?: EmployeeStatus
}

export interface CreateEmployeeRequest {
  full_name: string
  email: string
  phone?: string | null
  position: string
  department_id: string
  hire_date: string
  role?: Role
}

export type UpdateEmployeeRequest = Partial<CreateEmployeeRequest> & { status?: EmployeeStatus }

export interface CreatedEmployee {
  employee: Employee
  /** Shown once; the backend only keeps a hash. */
  temporary_password: string
}

export interface UpdatedEmployee {
  employee: Employee
  /** Only when the update reactivated the employee. */
  temporary_password: string | null
}

export interface TemporaryPassword {
  temporary_password: string
}

export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = ['ACTIVE', 'INACTIVE']

// Runtime checks for API responses (used with parseWith in services/).

const isString = (value: unknown): value is string => typeof value === 'string'
const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string'

export function isDepartment(value: unknown): value is Department {
  return isRecord(value) && isString(value.id) && isString(value.name)
}

export function isDepartmentList(value: unknown): value is Department[] {
  return Array.isArray(value) && value.every(isDepartment)
}

function isEmployeeAccount(value: unknown): value is EmployeeAccount {
  return (
    isRecord(value) &&
    isString(value.user_id) &&
    isString(value.employee_id) &&
    isString(value.email) &&
    (value.role === 'ADMIN' || value.role === 'EMPLOYEE') &&
    typeof value.is_active === 'boolean' &&
    typeof value.must_change_password === 'boolean' &&
    isStringOrNull(value.last_login_at)
  )
}

export function isEmployee(value: unknown): value is Employee {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.employee_code) &&
    isString(value.full_name) &&
    isString(value.email) &&
    isStringOrNull(value.phone) &&
    isString(value.position) &&
    isDepartment(value.department) &&
    isString(value.hire_date) &&
    (value.status === 'ACTIVE' || value.status === 'INACTIVE') &&
    isStringOrNull(value.created_by) &&
    isStringOrNull(value.updated_by) &&
    isString(value.created_at) &&
    isString(value.updated_at) &&
    (value.account === null || isEmployeeAccount(value.account))
  )
}

export function isEmployeeList(value: unknown): value is EmployeeList {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isEmployee)) return false
  const meta = value.meta
  return (
    isRecord(meta) &&
    typeof meta.page === 'number' &&
    typeof meta.limit === 'number' &&
    typeof meta.total === 'number' &&
    typeof meta.total_pages === 'number'
  )
}

export function isCreatedEmployee(value: unknown): value is CreatedEmployee {
  return isRecord(value) && isEmployee(value.employee) && isString(value.temporary_password)
}

export function isUpdatedEmployee(value: unknown): value is UpdatedEmployee {
  return isRecord(value) && isEmployee(value.employee) && isStringOrNull(value.temporary_password)
}

export function isTemporaryPassword(value: unknown): value is TemporaryPassword {
  return isRecord(value) && isString(value.temporary_password)
}
