import type { Role } from '../types/auth'
import type { CreateEmployeeRequest, Employee, UpdateEmployeeRequest } from '../types/employee'
import type { FieldErrors, FormErrors } from './form-errors'
import { toFormErrors } from './form-errors'
import { looksLikeEmail } from './password-rules'

/** What the employee form edits. All strings, as form inputs are. */
export interface EmployeeFormValues {
  full_name: string
  email: string
  phone: string
  position: string
  department_id: string
  hire_date: string
  role: Role
}

export const EMPLOYEE_FORM_FIELDS = ['full_name', 'email', 'phone', 'position', 'department_id', 'hire_date', 'role'] as const
export type EmployeeFormField = (typeof EMPLOYEE_FORM_FIELDS)[number]

// Same rules as the backend DTOs (backend/docs/api/employees.md); the server re-checks everything.
const PHONE_PATTERN = /^\+?[0-9][0-9 -]{5,18}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function emptyEmployeeForm(hireDate: string): EmployeeFormValues {
  return { full_name: '', email: '', phone: '', position: '', department_id: '', hire_date: hireDate, role: 'EMPLOYEE' }
}

export function employeeToFormValues(employee: Employee): EmployeeFormValues {
  return {
    full_name: employee.full_name,
    email: employee.email,
    phone: employee.phone ?? '',
    position: employee.position,
    department_id: employee.department.id,
    hire_date: employee.hire_date,
    role: employee.account?.role ?? 'EMPLOYEE',
  }
}

export function validateEmployeeForm(values: EmployeeFormValues): FieldErrors<EmployeeFormField> {
  const errors: FieldErrors<EmployeeFormField> = {}
  if (!values.full_name.trim()) errors.full_name = 'Full name is required'
  else if (values.full_name.trim().length > 150) errors.full_name = 'Full name must be at most 150 characters'
  if (!values.email.trim()) errors.email = 'Email is required'
  else if (!looksLikeEmail(values.email)) errors.email = 'Enter a valid email address'
  if (values.phone.trim() && !PHONE_PATTERN.test(values.phone.trim())) {
    errors.phone = 'Use digits, spaces and "-", with an optional leading "+" (6-20 characters)'
  }
  if (!values.position.trim()) errors.position = 'Position is required'
  if (!values.department_id) errors.department_id = 'Choose a department'
  if (!DATE_PATTERN.test(values.hire_date)) errors.hire_date = 'Hire date is required'
  return errors
}

export function toCreateRequest(values: EmployeeFormValues): CreateEmployeeRequest {
  return {
    full_name: values.full_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim() || null,
    position: values.position.trim(),
    department_id: values.department_id,
    hire_date: values.hire_date,
    role: values.role,
  }
}

/** Only the profile fields that changed (role and status are separate account actions). */
export function toUpdateRequest(values: EmployeeFormValues, original: Employee): UpdateEmployeeRequest {
  const next = toCreateRequest(values)
  const changes: UpdateEmployeeRequest = {}
  if (next.full_name !== original.full_name) changes.full_name = next.full_name
  if (next.email.toLowerCase() !== original.email) changes.email = next.email
  if ((next.phone ?? null) !== original.phone) changes.phone = next.phone ?? null
  if (next.position !== original.position) changes.position = next.position
  if (next.department_id !== original.department.id) changes.department_id = next.department_id
  if (next.hire_date !== original.hire_date) changes.hire_date = next.hire_date
  return changes
}

/**
 * Turns an API error from create/update into form errors. Validation messages
 * are matched by field name; the plain 400/409 messages about the email or the
 * department are moved onto that field too.
 */
export function employeeFormErrors(error: unknown): FormErrors<EmployeeFormField> {
  const result = toFormErrors(error, EMPLOYEE_FORM_FIELDS)
  if (result.form && /email/i.test(result.form)) return { fields: { ...result.fields, email: result.form }, form: null }
  if (result.form && /department/i.test(result.form)) {
    return { fields: { ...result.fields, department_id: result.form }, form: null }
  }
  return result
}
