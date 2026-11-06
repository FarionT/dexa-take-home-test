import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError, col, fn } from 'sequelize';
import type { WhereOptions } from 'sequelize';
import { attendanceDateOf, rpcError } from '@app/shared';
import type {
  AttendanceDay,
  AttendanceDayListResult,
  AttendancePhotoLocation,
  AttendanceRecord,
  FindAttendancePhotoRequest,
  ListAttendanceDaysRequest,
  RecordAttendanceRequest,
  TodayAttendanceRequest,
} from '@app/shared';
import { Attendance } from './attendance.model.js';
import type { AttendanceAttributes } from './attendance.model.js';

export const ALREADY_CHECKED_IN = 'You have already checked in today';
export const NOT_CHECKED_IN = 'You have not checked in today';
export const ALREADY_CHECKED_OUT = 'You have already checked out today';
export const NOT_FOUND = 'Attendance not found';

const MS_PER_MINUTE = 60_000;

/**
 * Check-in / check-out rules (docs/database-design.md → attendances):
 * one check-in and one check-out per employee per working day (Asia/Jakarta),
 * and a check-out only after that day's check-in. Times come from this server.
 */
@Injectable()
export class AttendancesService {
  constructor(@InjectModel(Attendance) private readonly attendances: typeof Attendance) {}

  async record(request: RecordAttendanceRequest, now: Date = new Date()): Promise<AttendanceRecord> {
    const attendanceDate = attendanceDateOf(now);
    const today = await this.attendances.findAll({
      where: { employee_id: request.employee_id, attendance_date: attendanceDate },
    });
    const hasCheckIn = today.some((row) => row.type === 'CHECK_IN');
    const hasCheckOut = today.some((row) => row.type === 'CHECK_OUT');

    if (request.type === 'CHECK_IN' && hasCheckIn) throw rpcError(HttpStatus.CONFLICT, ALREADY_CHECKED_IN);
    if (request.type === 'CHECK_OUT' && !hasCheckIn) throw rpcError(HttpStatus.BAD_REQUEST, NOT_CHECKED_IN);
    if (request.type === 'CHECK_OUT' && hasCheckOut) throw rpcError(HttpStatus.CONFLICT, ALREADY_CHECKED_OUT);

    try {
      const created = await this.attendances.create({
        employee_id: request.employee_id,
        type: request.type,
        attendance_date: attendanceDate,
        recorded_at: now,
        photo_path: request.photo_path,
        photo_mime: request.photo_mime,
        photo_size: request.photo_size,
        notes: request.notes,
      });
      return toRecord(created);
    } catch (error: unknown) {
      // Two simultaneous requests both passed the check above: the unique key
      // (employee_id, attendance_date, type, not_deleted) lets only one in.
      if (error instanceof UniqueConstraintError) {
        throw rpcError(HttpStatus.CONFLICT, request.type === 'CHECK_IN' ? ALREADY_CHECKED_IN : ALREADY_CHECKED_OUT);
      }
      throw error;
    }
  }

  /** The caller's current working day; check_in / check_out are null until done. */
  async today({ employee_id: employeeId }: TodayAttendanceRequest, now: Date = new Date()): Promise<AttendanceDay> {
    const attendanceDate = attendanceDateOf(now);
    const rows = await this.attendances.findAll({ where: { employee_id: employeeId, attendance_date: attendanceDate } });
    return toDay(employeeId, attendanceDate, rows);
  }

  /**
   * Working days (one item per employee per date): newest date first, and
   * within a date whoever clocked in first. Paginates days, not rows, so a
   * check-in and its check-out never land on different pages.
   */
  async listDays(request: ListAttendanceDaysRequest): Promise<AttendanceDayListResult> {
    if (request.employee_ids?.length === 0) return { items: [], total: 0 };

    const conditions: WhereOptions<AttendanceAttributes>[] = [];
    if (request.employee_ids) conditions.push({ employee_id: { [Op.in]: request.employee_ids } });
    if (request.date_from) conditions.push({ attendance_date: { [Op.gte]: request.date_from } });
    if (request.date_to) conditions.push({ attendance_date: { [Op.lte]: request.date_to } });
    const where: WhereOptions<AttendanceAttributes> = { [Op.and]: conditions };
    const group = ['employee_id', 'attendance_date'];

    const [days, counted] = await Promise.all([
      this.attendances.findAll({
        attributes: ['employee_id', 'attendance_date'],
        where,
        group,
        // employee_id breaks ties so pages never overlap.
        order: [
          ['attendance_date', 'DESC'],
          [fn('MIN', col('recorded_at')), 'ASC'],
          ['employee_id', 'ASC'],
        ],
        limit: request.limit,
        offset: (request.page - 1) * request.limit,
        raw: true,
      }),
      // With `group`, count() returns one entry per day: their number is the total.
      this.attendances.count({ where, group }),
    ]);
    if (days.length === 0) return { items: [], total: counted.length };

    // One query for every row of the days on this page.
    const rows = await this.attendances.findAll({
      where: {
        employee_id: { [Op.in]: [...new Set(days.map((day) => day.employee_id))] },
        attendance_date: { [Op.in]: [...new Set(days.map((day) => day.attendance_date))] },
      },
    });
    const byDay = new Map<string, Attendance[]>();
    for (const row of rows) {
      const key = dayKey(row.employee_id, row.attendance_date);
      byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }

    return {
      items: days.map((day) =>
        toDay(day.employee_id, day.attendance_date, byDay.get(dayKey(day.employee_id, day.attendance_date)) ?? []),
      ),
      total: counted.length,
    };
  }

  /**
   * Where the photo of a record is stored. Someone who is neither the owner nor
   * an ADMIN gets the same 404 as for an unknown id, so ids can't be probed.
   */
  async findPhoto({ id, viewer_employee_id: viewerId, viewer_is_admin: isAdmin }: FindAttendancePhotoRequest): Promise<AttendancePhotoLocation> {
    const row = await this.attendances.findByPk(id);
    if (!row || (!isAdmin && row.employee_id !== viewerId)) throw rpcError(HttpStatus.NOT_FOUND, NOT_FOUND);
    return { photo_path: row.photo_path, photo_mime: row.photo_mime };
  }
}

function dayKey(employeeId: string, attendanceDate: string): string {
  return `${employeeId}|${attendanceDate}`;
}

function toRecord(row: Attendance): AttendanceRecord {
  return {
    id: row.id,
    employee_id: row.employee_id,
    type: row.type,
    attendance_date: row.attendance_date,
    recorded_at: row.recorded_at.toISOString(),
    notes: row.notes,
    photo: { mime: row.photo_mime, size: row.photo_size },
  };
}

function toDay(employeeId: string, attendanceDate: string, rows: Attendance[]): AttendanceDay {
  const checkIn = rows.find((row) => row.type === 'CHECK_IN');
  const checkOut = rows.find((row) => row.type === 'CHECK_OUT');
  return {
    employee_id: employeeId,
    attendance_date: attendanceDate,
    check_in: checkIn ? toRecord(checkIn) : null,
    check_out: checkOut ? toRecord(checkOut) : null,
    work_minutes:
      checkIn && checkOut
        ? Math.floor((checkOut.recorded_at.getTime() - checkIn.recorded_at.getTime()) / MS_PER_MINUTE)
        : null,
  };
}
