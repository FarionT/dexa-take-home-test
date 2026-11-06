import type { AttendanceDay, AttendanceType } from '../types/attendance'

/** Same limits as the backend (UPLOAD_MAX_SIZE_MB = 5, JPEG / PNG / WebP); checked here only to fail fast. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const NOTES_MAX_LENGTH = 255

/** What the employee can do next today: check in, check out, or nothing. */
export function nextAction(day: AttendanceDay): AttendanceType | null {
  if (!day.check_in) return 'CHECK_IN'
  if (!day.check_out) return 'CHECK_OUT'
  return null
}

export const ACTION_LABEL: Record<AttendanceType, string> = { CHECK_IN: 'Check in', CHECK_OUT: 'Check out' }
export const TYPE_LABEL: Record<AttendanceType, string> = { CHECK_IN: 'Check-in', CHECK_OUT: 'Check-out' }

/** Reads YYYY-MM-DD from a URL param, or '' if it isn't one. */
export function readIsoDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

export type DayStatus = 'complete' | 'working' | 'no-check-out'

/** A day with a check-in but no check-out is still in progress today, and a forgotten check-out before that. */
export function dayStatus(day: AttendanceDay, today: string): DayStatus {
  if (day.check_out) return 'complete'
  return day.attendance_date === today ? 'working' : 'no-check-out'
}

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  complete: 'Complete',
  working: 'Working',
  'no-check-out': 'No check-out',
}
