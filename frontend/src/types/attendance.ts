import { isRecord } from './api'
import { isDepartment } from './employee'
import type { Department, EmployeeStatus } from './employee'

// Mirrors backend/docs/api/attendance.md (snake_case data fields, as in the API).

export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT'

/** One check-in or check-out. The time and date are set by the server. */
export interface Attendance {
  id: string
  employee_id: string
  type: AttendanceType
  /** YYYY-MM-DD, working day in Asia/Jakarta. */
  attendance_date: string
  /** ISO 8601, UTC. */
  recorded_at: string
  notes: string | null
  photo: {
    mime: string
    size: number
    /** Gateway path; needs the token, so it is loaded through the API client. */
    url: string
  }
}

/** One employee's working day. */
export interface AttendanceDay {
  employee_id: string
  attendance_date: string
  check_in: Attendance | null
  check_out: Attendance | null
  /** Null until both exist. */
  work_minutes: number | null
}

export interface PageMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface AttendanceDayList {
  items: AttendanceDay[]
  meta: PageMeta
}

/** Who a day belongs to, in HR's list. Deleted employees still have a name. */
export interface AttendanceEmployee {
  id: string
  employee_code: string
  full_name: string
  department: Department
  status: EmployeeStatus
  is_deleted: boolean
}

export interface MonitoringDay extends AttendanceDay {
  employee: AttendanceEmployee | null
}

export interface MonitoringList {
  items: MonitoringDay[]
  /** date_from / date_to: the range the backend used (today when none was sent); null = open. */
  meta: PageMeta & { date_from: string | null; date_to: string | null }
}

export interface ListMyAttendanceQuery {
  page?: number
  limit?: number
  date_from?: string
  date_to?: string
}

export interface ListAttendanceQuery extends ListMyAttendanceQuery {
  department_id?: string
  search?: string
}

// Runtime checks for API responses (used with parseWith in services/).

const isString = (value: unknown): value is string => typeof value === 'string'
const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string'

export function isAttendance(value: unknown): value is Attendance {
  const photo = isRecord(value) ? value.photo : undefined
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.employee_id) &&
    (value.type === 'CHECK_IN' || value.type === 'CHECK_OUT') &&
    isString(value.attendance_date) &&
    isString(value.recorded_at) &&
    isStringOrNull(value.notes) &&
    isRecord(photo) &&
    isString(photo.mime) &&
    typeof photo.size === 'number' &&
    isString(photo.url)
  )
}

export function isAttendanceDay(value: unknown): value is AttendanceDay {
  return (
    isRecord(value) &&
    isString(value.employee_id) &&
    isString(value.attendance_date) &&
    (value.check_in === null || isAttendance(value.check_in)) &&
    (value.check_out === null || isAttendance(value.check_out)) &&
    (value.work_minutes === null || typeof value.work_minutes === 'number')
  )
}

function isPageMeta(value: unknown): value is PageMeta {
  return (
    isRecord(value) &&
    typeof value.page === 'number' &&
    typeof value.limit === 'number' &&
    typeof value.total === 'number' &&
    typeof value.total_pages === 'number'
  )
}

export function isAttendanceDayList(value: unknown): value is AttendanceDayList {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(isAttendanceDay) && isPageMeta(value.meta)
}

function isAttendanceEmployee(value: unknown): value is AttendanceEmployee {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.employee_code) &&
    isString(value.full_name) &&
    isDepartment(value.department) &&
    (value.status === 'ACTIVE' || value.status === 'INACTIVE') &&
    typeof value.is_deleted === 'boolean'
  )
}

function isMonitoringDay(value: unknown): value is MonitoringDay {
  return isAttendanceDay(value) && isRecord(value) && (value.employee === null || isAttendanceEmployee(value.employee))
}

export function isMonitoringList(value: unknown): value is MonitoringList {
  const meta = isRecord(value) ? value.meta : undefined
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isMonitoringDay) &&
    isPageMeta(meta) &&
    isRecord(meta) &&
    isStringOrNull(meta.date_from) &&
    isStringOrNull(meta.date_to)
  )
}
