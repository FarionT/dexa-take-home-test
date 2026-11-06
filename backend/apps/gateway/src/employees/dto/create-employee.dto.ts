import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ROLES } from '@app/shared';
import type { Role } from '@app/shared';
import { toNormalizedEmail, trimString, trimToNull } from './transforms.js';

export const PHONE_PATTERN = /^\+?[0-9][0-9 -]{5,18}$/;
export const PHONE_MESSAGE = 'phone may only contain digits, spaces and "-", with an optional leading "+" (6-20 characters)';
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** POST /employees. The code, password and status are set by the system. */
export class CreateEmployeeDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'full_name is required' })
  @MaxLength(150)
  full_name: string;

  @Transform(toNormalizedEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string | null;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'position is required' })
  @MaxLength(100)
  position: string;

  @IsUUID('all', { message: 'department_id must be a valid id' })
  department_id: string;

  // Date only (YYYY-MM-DD); strict rejects impossible dates such as 2026-02-30.
  @Matches(DATE_ONLY, { message: 'hire_date must be a date in YYYY-MM-DD format' })
  @IsISO8601({ strict: true }, { message: 'hire_date must be a valid date' })
  hire_date: string;

  /** Defaults to EMPLOYEE. Only an ADMIN reaches this endpoint, so only an ADMIN can create another ADMIN. */
  @IsOptional()
  @IsIn(ROLES, { message: `role must be one of: ${ROLES.join(', ')}` })
  role?: Role;
}
