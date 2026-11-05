import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ATTENDANCE_PATTERNS } from '@app/shared';
import type { ServicePing } from '@app/shared';
import { AttendanceService } from './attendance.service.js';

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @MessagePattern(ATTENDANCE_PATTERNS.PING)
  ping(): ServicePing {
    return this.attendanceService.ping();
  }
}
