import type {
  AttendanceDay,
  AttendanceDayList,
  Attendance,
  AttendanceType,
  ListAttendanceQuery,
  ListMyAttendanceQuery,
  MonitoringList,
} from '../types/attendance'
import { isAttendance, isAttendanceDay, isAttendanceDayList, isMonitoringList } from '../types/attendance'
import { parseWith, request, requestBlob } from './http'

// Endpoints: backend/docs/api/attendance.md

const RECORD_PATH: Record<AttendanceType, string> = {
  CHECK_IN: '/attendance/check-in',
  CHECK_OUT: '/attendance/check-out',
}

export interface RecordAttendanceInput {
  photo: Blob
  /** File name sent with the photo; the server ignores it and picks its own. */
  fileName: string
  notes: string
}

/**
 * Check-in or check-out. Sent as multipart/form-data; axios sets the
 * Content-Type with the boundary itself when the body is a FormData.
 */
export function recordAttendance(type: AttendanceType, input: RecordAttendanceInput): Promise<Attendance> {
  const form = new FormData()
  form.append('photo', input.photo, input.fileName)
  const notes = input.notes.trim()
  if (notes) form.append('notes', notes)
  return request({ method: 'POST', url: RECORD_PATH[type], data: form }, parseWith(isAttendance, 'attendance'))
}

export function getTodayAttendance(): Promise<AttendanceDay> {
  return request({ method: 'GET', url: '/attendance/me/today' }, parseWith(isAttendanceDay, "today's attendance"))
}

export function listMyAttendance(query: ListMyAttendanceQuery): Promise<AttendanceDayList> {
  const params = {
    page: query.page,
    limit: query.limit,
    date_from: query.date_from || undefined,
    date_to: query.date_to || undefined,
  }
  return request({ method: 'GET', url: '/attendance/me', params }, parseWith(isAttendanceDayList, 'attendance history'))
}

/** HR only. Without dates the backend shows today. */
export function listAttendance(query: ListAttendanceQuery): Promise<MonitoringList> {
  const params = {
    page: query.page,
    limit: query.limit,
    date_from: query.date_from || undefined,
    date_to: query.date_to || undefined,
    department_id: query.department_id || undefined,
    search: query.search?.trim() || undefined,
  }
  return request({ method: 'GET', url: '/attendance', params }, parseWith(isMonitoringList, 'attendance list'))
}

/** The photo of a check-in / check-out, as a Blob (an <img src> can't send the token). */
export function getAttendancePhoto(photoUrl: string): Promise<Blob> {
  return requestBlob({ method: 'GET', url: photoUrl })
}
