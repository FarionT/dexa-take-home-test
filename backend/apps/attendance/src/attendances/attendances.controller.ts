import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ATTENDANCE_PATTERNS } from '@app/shared';
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
import { AttendancesService } from './attendances.service.js';

/** TCP handlers. Payloads were already validated by the gateway's DTOs. */
@Controller()
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @MessagePattern(ATTENDANCE_PATTERNS.RECORD)
  record(@Payload() request: RecordAttendanceRequest): Promise<AttendanceRecord> {
    return this.attendancesService.record(request);
  }

  @MessagePattern(ATTENDANCE_PATTERNS.TODAY)
  today(@Payload() request: TodayAttendanceRequest): Promise<AttendanceDay> {
    return this.attendancesService.today(request);
  }

  @MessagePattern(ATTENDANCE_PATTERNS.LIST_DAYS)
  listDays(@Payload() request: ListAttendanceDaysRequest): Promise<AttendanceDayListResult> {
    return this.attendancesService.listDays(request);
  }

  @MessagePattern(ATTENDANCE_PATTERNS.FIND_PHOTO)
  findPhoto(@Payload() request: FindAttendancePhotoRequest): Promise<AttendancePhotoLocation> {
    return this.attendancesService.findPhoto(request);
  }
}
