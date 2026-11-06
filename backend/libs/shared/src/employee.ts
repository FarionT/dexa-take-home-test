import type { EmployeeStatus } from './domain.js';

// Data shapes exchanged with the employee service. Login data (role, password,
// active flag) is not here: it belongs to the auth service (see auth.ts).

export interface DepartmentRecord {
  id: string;
  name: string;
}

/** An employee as the employee service returns it. Dates are ISO strings. */
export interface EmployeeRecord {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  position: string;
  department: DepartmentRecord;
  /** YYYY-MM-DD */
  hire_date: string;
  status: EmployeeStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** The HR fields of an employee, as sent on create. */
export interface EmployeeProfileInput {
  full_name: string;
  email: string;
  phone: string | null;
  position: string;
  department_id: string;
  hire_date: string;
}

/** Fields an update may change. */
export type EmployeeChanges = Partial<EmployeeProfileInput> & { status?: EmployeeStatus };

// Message payloads (gateway -> employee service).

export interface CreateEmployeeRequest {
  profile: EmployeeProfileInput;
  /** The HR employee creating the record (from their JWT). */
  actor_employee_id: string;
}

export interface ListEmployeesRequest {
  page: number;
  limit: number;
  search?: string;
  department_id?: string;
  status?: EmployeeStatus;
}

export interface EmployeeListResult {
  items: EmployeeRecord[];
  total: number;
}

export interface FindEmployeeRequest {
  id: string;
}

export interface UpdateEmployeeRequest {
  id: string;
  changes: EmployeeChanges;
  /** Who made the change; null only when restoring a seeded row's original value. */
  actor_employee_id: string | null;
}

export interface UpdateEmployeeResult {
  employee: EmployeeRecord;
  /** The old values of the changed fields, so the gateway can undo the update. */
  previous: EmployeeChanges;
  previous_updated_by: string | null;
}

export interface DeleteEmployeeRequest {
  id: string;
}

/**
 * Who an attendance record belongs to (HR monitoring). Deleted employees are
 * included, so their old records still show a name.
 */
export interface EmployeeSummary {
  id: string;
  employee_code: string;
  full_name: string;
  department: DepartmentRecord;
  status: EmployeeStatus;
  is_deleted: boolean;
}

/** Ids of the employees matching HR's filters (deleted ones included). */
export interface FindEmployeeIdsRequest {
  /** Partial match on name, employee code or email, as in the employee list. */
  search?: string;
  department_id?: string;
}

export interface FindEmployeesByIdsRequest {
  ids: string[];
}
