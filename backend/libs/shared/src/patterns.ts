/**
 * Message patterns: the "routes" of each microservice. The gateway sends to
 * these and the service's controllers handle them with @MessagePattern.
 */
export const AUTH_PATTERNS = {
  PING: 'auth.ping',
  LOGIN: 'auth.login',
  ME: 'auth.me',
  CHANGE_PASSWORD: 'auth.change-password',
  // Account management, sent by the gateway's employee endpoints.
  CREATE_USER: 'auth.create-user',
  FIND_ACCOUNTS: 'auth.find-accounts',
  UPDATE_ACCOUNT: 'auth.update-account',
  RESET_PASSWORD: 'auth.reset-password',
  DELETE_USER: 'auth.delete-user',
  RESTORE_USER: 'auth.restore-user',
} as const;

export const EMPLOYEE_PATTERNS = {
  PING: 'employee.ping',
  LIST_DEPARTMENTS: 'employee.list-departments',
  CREATE: 'employee.create',
  LIST: 'employee.list',
  FIND_ONE: 'employee.find-one',
  UPDATE: 'employee.update',
  DELETE: 'employee.delete',
} as const;

export const ATTENDANCE_PATTERNS = {
  PING: 'attendance.ping',
} as const;
