import type { AttendanceType } from './domain.js';

/**
 * The working day is counted in this time zone (WIB). Times are stored in UTC;
 * only `attendance_date` depends on it.
 */
export const ATTENDANCE_TIME_ZONE = 'Asia/Jakarta';

/** Photo types accepted for check-in / check-out (checked by file signature, not by the client's header). */
export const ATTENDANCE_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AttendancePhotoMime = (typeof ATTENDANCE_PHOTO_MIMES)[number];

export const ATTENDANCE_NOTES_MAX_LENGTH = 255;

/** 'YYYY-MM-DD' of the working day `at` falls on, in ATTENDANCE_TIME_ZONE. */
export function attendanceDateOf(at: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** One clock event as the attendance service returns it. Never contains the file path. */
export interface AttendanceRecord {
  id: string;
  employee_id: string;
  type: AttendanceType;
  /** YYYY-MM-DD, working day in Asia/Jakarta. */
  attendance_date: string;
  /** ISO 8601, UTC, set by the server. */
  recorded_at: string;
  notes: string | null;
  photo: {
    mime: string;
    size: number;
  };
}

/** One employee's working day: the check-in and check-out of that date. */
export interface AttendanceDay {
  employee_id: string;
  attendance_date: string;
  check_in: AttendanceRecord | null;
  check_out: AttendanceRecord | null;
  /** Whole minutes between check-in and check-out; null until both exist. */
  work_minutes: number | null;
}

export interface AttendanceDayListResult {
  items: AttendanceDay[];
  total: number;
}

// Message payloads (gateway -> attendance service).

/** The photo is already saved by the gateway; only its path and metadata travel over TCP. */
export interface RecordAttendanceRequest {
  /** From the JWT, never from the request. */
  employee_id: string;
  type: AttendanceType;
  /** Relative to UPLOAD_DIR. */
  photo_path: string;
  photo_mime: AttendancePhotoMime;
  photo_size: number;
  notes: string | null;
}

export interface TodayAttendanceRequest {
  employee_id: string;
}

export interface ListAttendanceDaysRequest {
  page: number;
  limit: number;
  /** Only these employees; leave out for everyone. */
  employee_ids?: string[];
  /** YYYY-MM-DD, inclusive. */
  date_from?: string;
  date_to?: string;
}

export interface FindAttendancePhotoRequest {
  id: string;
  /** Who asks: the owner or an ADMIN may see the photo; anyone else gets 404. */
  viewer_employee_id: string;
  viewer_is_admin: boolean;
}

export interface AttendancePhotoLocation {
  photo_path: string;
  photo_mime: string;
}
