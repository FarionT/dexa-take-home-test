/**
 * Message patterns: the "routes" of each microservice. The gateway sends to
 * these and the service's controllers handle them with @MessagePattern.
 */
export const AUTH_PATTERNS = {
  PING: 'auth.ping',
} as const;

export const EMPLOYEE_PATTERNS = {
  PING: 'employee.ping',
} as const;

export const ATTENDANCE_PATTERNS = {
  PING: 'attendance.ping',
} as const;
