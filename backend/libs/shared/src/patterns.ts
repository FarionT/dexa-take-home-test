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
  // Lookups for the HR attendance view (deleted employees included).
  FIND_IDS: 'employee.find-ids',
  FIND_BY_IDS: 'employee.find-by-ids',
} as const;

export const ATTENDANCE_PATTERNS = {
  PING: 'attendance.ping',
  /** Check-in or check-out (the `type` in the payload says which). */
  RECORD: 'attendance.record',
  TODAY: 'attendance.today',
  LIST_DAYS: 'attendance.list-days',
  FIND_PHOTO: 'attendance.find-photo',
} as const;
