import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger, StreamableFile } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { ATTENDANCE_PATTERNS, EMPLOYEE_PATTERNS, SERVICE_CLIENTS, attendanceDateOf } from '@app/shared';
import type {
  AttendanceDay,
  AttendanceDayListResult,
  AttendancePhotoLocation,
  AttendanceRecord,
  AttendanceType,
  EmployeeRecord,
  EmployeeSummary,
  FindAttendancePhotoRequest,
  FindEmployeeIdsRequest,
  FindEmployeeRequest,
  FindEmployeesByIdsRequest,
  JwtPayload,
  ListAttendanceDaysRequest,
  RecordAttendanceRequest,
  TodayAttendanceRequest,
} from '@app/shared';
import { sendToService } from '../clients/rpc.js';
import type { AttendanceDayListView, AttendanceDayView, AttendanceView, HrAttendanceListView } from './attendance.types.js';
import type { ListAllAttendanceQueryDto } from './dto/list-all-attendance.query.js';
import type { ListAttendanceQueryDto } from './dto/list-attendance.query.js';
import type { RecordAttendanceDto } from './dto/record-attendance.dto.js';
import type { ValidatedPhoto } from './photo/photo-file.pipe.js';
import { PhotoStorageService } from './photo/photo-storage.service.js';

export const EMPLOYEE_INACTIVE = 'Your employee record is inactive. Please contact HR.';
export const DATE_RANGE_REVERSED = 'date_from must not be after date_to';

/**
 * Attendance endpoints. Check-in / check-out:
 *   1. the employee must still be ACTIVE (a token stays valid until it expires),
 *   2. the gateway saves the photo to disk (large files don't travel over TCP),
 *   3. the attendance service applies the day rules and stores the record.
 * If step 3 refuses or fails, the saved photo is removed again.
 */
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @Inject(SERVICE_CLIENTS.attendance) private readonly attendanceClient: ClientProxy,
    @Inject(SERVICE_CLIENTS.employee) private readonly employeeClient: ClientProxy,
    private readonly photos: PhotoStorageService,
  ) {}

  async record(type: AttendanceType, user: JwtPayload, photo: ValidatedPhoto, dto: RecordAttendanceDto): Promise<AttendanceView> {
    await this.assertActiveEmployee(user.employee_id);

    const photoPath = await this.photos.save(photo);
    try {
      const record = await sendToService<AttendanceRecord, RecordAttendanceRequest>(
        this.attendanceClient,
        ATTENDANCE_PATTERNS.RECORD,
        {
          employee_id: user.employee_id,
          type,
          photo_path: photoPath,
          photo_mime: photo.mime,
          photo_size: photo.size,
          notes: dto.notes ?? null,
        },
      );
      return toView(record);
    } catch (error: unknown) {
      // The record wasn't stored (e.g. already checked in), so its photo is an orphan.
      // 503 is the exception: after a timeout the service may still have stored
      // the record, so the file is kept (an orphan file is the lesser problem).
      if (!(error instanceof HttpException && error.getStatus() === HttpStatus.SERVICE_UNAVAILABLE)) {
        await this.removePhoto(photoPath);
      }
      throw error;
    }
  }

  async today(user: JwtPayload): Promise<AttendanceDayView> {
    const day = await sendToService<AttendanceDay, TodayAttendanceRequest>(this.attendanceClient, ATTENDANCE_PATTERNS.TODAY, {
      employee_id: user.employee_id,
    });
    return toDayView(day);
  }

  async listMine(user: JwtPayload, query: ListAttendanceQueryDto): Promise<AttendanceDayListView> {
    const { page, limit, date_from: dateFrom, date_to: dateTo } = query;
    assertDateRange(dateFrom, dateTo);

    const result = await sendToService<AttendanceDayListResult, ListAttendanceDaysRequest>(
      this.attendanceClient,
      ATTENDANCE_PATTERNS.LIST_DAYS,
      { page, limit, employee_ids: [user.employee_id], date_from: dateFrom, date_to: dateTo },
    );
    return {
      items: result.items.map(toDayView),
      meta: { page, limit, total: result.total, total_pages: Math.ceil(result.total / limit) },
    };
  }

  /**
   * HR monitoring (read only): everyone's working days. Data from two services:
   *   1. employee filters (department, search) -> matching employee ids (employee service)
   *   2. the days of those employees in the date range (attendance service)
   *   3. names for the employees on this page, in one batch (employee service)
   * Only days with a check-in exist, so employees who didn't clock in aren't listed.
   */
  async listAll(query: ListAllAttendanceQueryDto, now: Date = new Date()): Promise<HrAttendanceListView> {
    const { page, limit, department_id: departmentId, search } = query;
    // No dates at all means today (Asia/Jakarta); one date alone leaves the other side open.
    const today = attendanceDateOf(now);
    const useToday = !query.date_from && !query.date_to;
    const dateFrom = useToday ? today : query.date_from;
    const dateTo = useToday ? today : query.date_to;
    assertDateRange(dateFrom, dateTo);

    const employeeIds =
      departmentId || search
        ? await sendToService<string[], FindEmployeeIdsRequest>(this.employeeClient, EMPLOYEE_PATTERNS.FIND_IDS, {
            department_id: departmentId,
            search: search || undefined,
          })
        : undefined;

    const result = await sendToService<AttendanceDayListResult, ListAttendanceDaysRequest>(
      this.attendanceClient,
      ATTENDANCE_PATTERNS.LIST_DAYS,
      { page, limit, employee_ids: employeeIds, date_from: dateFrom, date_to: dateTo },
    );

    const pageIds = [...new Set(result.items.map((day) => day.employee_id))];
    const employees =
      pageIds.length > 0
        ? await sendToService<EmployeeSummary[], FindEmployeesByIdsRequest>(this.employeeClient, EMPLOYEE_PATTERNS.FIND_BY_IDS, {
            ids: pageIds,
          })
        : [];
    const byId = new Map(employees.map((employee) => [employee.id, employee]));

    return {
      items: result.items.map((day) => ({ ...toDayView(day), employee: byId.get(day.employee_id) ?? null })),
      meta: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
        date_from: dateFrom ?? null,
        date_to: dateTo ?? null,
      },
    };
  }

  /** The photo file of a record: for its owner or an ADMIN (the attendance service decides). */
  async photo(id: string, user: JwtPayload): Promise<StreamableFile> {
    const location = await sendToService<AttendancePhotoLocation, FindAttendancePhotoRequest>(
      this.attendanceClient,
      ATTENDANCE_PATTERNS.FIND_PHOTO,
      { id, viewer_employee_id: user.employee_id, viewer_is_admin: user.role === 'ADMIN' },
    );
    const { stream, size } = await this.photos.open(location.photo_path);
    return new StreamableFile(stream, { type: location.photo_mime, length: size, disposition: 'inline' });
  }

  /** A deactivated or deleted employee can't clock in, even with a token that hasn't expired yet. */
  private async assertActiveEmployee(employeeId: string): Promise<void> {
    let employee: EmployeeRecord;
    try {
      employee = await sendToService<EmployeeRecord, FindEmployeeRequest>(this.employeeClient, EMPLOYEE_PATTERNS.FIND_ONE, {
        id: employeeId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND) {
        throw new ForbiddenException(EMPLOYEE_INACTIVE);
      }
      throw error;
    }
    if (employee.status !== 'ACTIVE') throw new ForbiddenException(EMPLOYEE_INACTIVE);
  }

  private async removePhoto(photoPath: string): Promise<void> {
    try {
      await this.photos.remove(photoPath);
    } catch (error: unknown) {
      // Not worth failing the request over: an orphan file only takes disk space.
      this.logger.warn(`Could not remove unused photo ${photoPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/** YYYY-MM-DD strings compare correctly as text. */
function assertDateRange(dateFrom?: string, dateTo?: string): void {
  if (dateFrom && dateTo && dateFrom > dateTo) throw new BadRequestException(DATE_RANGE_REVERSED);
}

export function photoUrl(id: string): string {
  return `/attendance/${id}/photo`;
}

function toView(record: AttendanceRecord): AttendanceView {
  return { ...record, photo: { ...record.photo, url: photoUrl(record.id) } };
}

function toDayView(day: AttendanceDay): AttendanceDayView {
  return {
    ...day,
    check_in: day.check_in ? toView(day.check_in) : null,
    check_out: day.check_out ? toView(day.check_out) : null,
  };
}
