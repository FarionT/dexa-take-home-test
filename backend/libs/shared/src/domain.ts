/**
 * Value lists shared by services and the gateway. The MySQL ENUM columns in
 * the migrations use exactly these values.
 */
export const ROLES = ['ADMIN', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const ATTENDANCE_TYPES = ['CHECK_IN', 'CHECK_OUT'] as const;
export type AttendanceType = (typeof ATTENDANCE_TYPES)[number];
