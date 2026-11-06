import type { Role } from '../types/auth'
import type { EmployeeStatus } from '../types/employee'

/** How roles and statuses are shown in the UI (the API values stay ADMIN / ACTIVE / …). */
export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'HR admin', EMPLOYEE: 'Employee' }
export const STATUS_LABEL: Record<EmployeeStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive' }
