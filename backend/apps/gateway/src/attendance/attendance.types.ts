import type { AttendanceDay, AttendanceRecord, EmployeeSummary } from '@app/shared';

/** A clock event as the API returns it: the photo is fetched from `photo.url` (with the token). */
export interface AttendanceView extends Omit<AttendanceRecord, 'photo'> {
  photo: {
    mime: string;
    size: number;
    /** Path on the gateway, e.g. `/attendance/<id>/photo`. */
    url: string;
  };
}

export interface AttendanceDayView extends Omit<AttendanceDay, 'check_in' | 'check_out'> {
  check_in: AttendanceView | null;
  check_out: AttendanceView | null;
}

/** A day in HR's list: who it belongs to. `employee` is null only if the employee record is gone entirely. */
export interface HrAttendanceDayView extends AttendanceDayView {
  employee: EmployeeSummary | null;
}

export interface HrAttendanceListView {
  items: HrAttendanceDayView[];
  meta: AttendanceDayListView['meta'] & {
    /** The date range actually used (today when none was given); null = open-ended. */
    date_from: string | null;
    date_to: string | null;
  };
}

export interface AttendanceDayListView {
  items: AttendanceDayView[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
