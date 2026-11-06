import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MaxLength } from 'class-validator';
import { EMPLOYEE_STATUSES } from '@app/shared';
import type { EmployeeStatus } from '@app/shared';
import { trimString } from './transforms.js';

export const MAX_PAGE_SIZE = 100;

/** GET /employees?page=1&limit=10&search=budi&department_id=…&status=ACTIVE */
export class ListEmployeesQueryDto {
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

  /** Matches name, employee code or email (partial, case-insensitive). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID('all', { message: 'department_id must be a valid id' })
  department_id?: string;

  @IsOptional()
  @IsIn(EMPLOYEE_STATUSES, { message: `status must be one of: ${EMPLOYEE_STATUSES.join(', ')}` })
  status?: EmployeeStatus;
}
