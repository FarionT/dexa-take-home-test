import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trimString } from '../../employees/dto/transforms.js';
import { ListAttendanceQueryDto } from './list-attendance.query.js';

/**
 * GET /attendance (HR): the paging and date filters of the own history, plus
 * employee filters. With neither date given, the list shows today.
 */
export class ListAllAttendanceQueryDto extends ListAttendanceQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'department_id must be a valid id' })
  department_id?: string;

  /** Matches employee name, code or email (partial, case-insensitive). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;
}
