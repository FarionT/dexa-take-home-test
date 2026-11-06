import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { JwtPayload } from '@app/shared';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { ResponseMessage } from '../common/api-response.js';
import { AttendanceService } from './attendance.service.js';
import type { AttendanceDayListView, AttendanceDayView, AttendanceView, HrAttendanceListView } from './attendance.types.js';
import { ListAllAttendanceQueryDto } from './dto/list-all-attendance.query.js';
import { ListAttendanceQueryDto } from './dto/list-attendance.query.js';
import { RecordAttendanceDto } from './dto/record-attendance.dto.js';
import { PHOTO_FIELD, PhotoFilePipe } from './photo/photo-file.pipe.js';
import type { ValidatedPhoto } from './photo/photo-file.pipe.js';

/**
 * WFH attendance of the logged-in employee (HR included), plus HR's read-only
 * view of everyone. The employee always comes from the token. Docs: docs/api/attendance.md
 */
@Roles('EMPLOYEE')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /** HR monitoring, read only. Today by default. */
  @Roles('ADMIN')
  @Get()
  @ResponseMessage('Attendance')
  listAll(@Query() query: ListAllAttendanceQueryDto): Promise<HrAttendanceListView> {
    return this.attendanceService.listAll(query);
  }

  /** multipart/form-data: `photo` (file) + optional `notes`. */
  @Post('check-in')
  @UseInterceptors(FileInterceptor(PHOTO_FIELD))
  @ResponseMessage('Checked in')
  checkIn(
    @CurrentUser() user: JwtPayload,
    @UploadedFile(PhotoFilePipe) photo: ValidatedPhoto,
    @Body() dto: RecordAttendanceDto,
  ): Promise<AttendanceView> {
    return this.attendanceService.record('CHECK_IN', user, photo, dto);
  }

  @Post('check-out')
  @UseInterceptors(FileInterceptor(PHOTO_FIELD))
  @ResponseMessage('Checked out')
  checkOut(
    @CurrentUser() user: JwtPayload,
    @UploadedFile(PhotoFilePipe) photo: ValidatedPhoto,
    @Body() dto: RecordAttendanceDto,
  ): Promise<AttendanceView> {
    return this.attendanceService.record('CHECK_OUT', user, photo, dto);
  }

  @Get('me/today')
  @ResponseMessage("Today's attendance")
  today(@CurrentUser() user: JwtPayload): Promise<AttendanceDayView> {
    return this.attendanceService.today(user);
  }

  @Get('me')
  @ResponseMessage('My attendance')
  listMine(@CurrentUser() user: JwtPayload, @Query() query: ListAttendanceQueryDto): Promise<AttendanceDayListView> {
    return this.attendanceService.listMine(user, query);
  }

  /** The image itself (not the JSON envelope). Owner or ADMIN only; others get 404. */
  @Get(':id/photo')
  @Header('Cache-Control', 'private, max-age=3600')
  @Header('X-Content-Type-Options', 'nosniff')
  photo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<StreamableFile> {
    return this.attendanceService.photo(id, user);
  }
}
