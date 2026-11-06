import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ATTENDANCE_NOTES_MAX_LENGTH } from '@app/shared';
import { trimToNull } from '../../employees/dto/transforms.js';

/**
 * Text fields of the multipart form for POST /attendance/check-in and
 * /check-out. The photo is a file field (`photo`), checked by PhotoFilePipe.
 * The time and the employee are never sent: the server sets them.
 */
export class RecordAttendanceDto {
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(ATTENDANCE_NOTES_MAX_LENGTH)
  notes?: string | null;
}
