import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Matches, Max, Min } from 'class-validator';
import { DATE_ONLY } from '../../employees/dto/create-employee.dto.js';
import { MAX_PAGE_SIZE } from '../../employees/dto/list-employees.query.js';

/** GET /attendance/me?page=1&limit=10&date_from=2026-11-01&date_to=2026-11-30 */
export class ListAttendanceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number' })
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number' })
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = 10;

  /** Inclusive, working day in Asia/Jakarta. */
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'date_from must be a date in YYYY-MM-DD format' })
  @IsISO8601({ strict: true }, { message: 'date_from must be a valid date' })
  date_from?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'date_to must be a date in YYYY-MM-DD format' })
  @IsISO8601({ strict: true }, { message: 'date_to must be a valid date' })
  date_to?: string;
}
