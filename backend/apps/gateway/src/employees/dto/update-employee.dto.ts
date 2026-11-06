import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { EMPLOYEE_STATUSES, ROLES } from '@app/shared';
import type { EmployeeStatus, Role } from '@app/shared';
import { DATE_ONLY, PHONE_MESSAGE, PHONE_PATTERN } from './create-employee.dto.js';
import { toNormalizedEmail, trimString, trimToNull } from './transforms.js';

/**
 * PATCH /employees/:id. Every field is optional; send only what changes.
 * `status` INACTIVE also blocks the login; ACTIVE again reactivates it with a
 * new temporary password. `role` and `status` follow the role guardrails.
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'full_name cannot be empty' })
  @MaxLength(150)
  full_name?: string;

  @IsOptional()
  @Transform(toNormalizedEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email?: string;

  /** null or "" clears the phone number. */
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'position cannot be empty' })
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsUUID('all', { message: 'department_id must be a valid id' })
  department_id?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'hire_date must be a date in YYYY-MM-DD format' })
  @IsISO8601({ strict: true }, { message: 'hire_date must be a valid date' })
  hire_date?: string;

  @IsOptional()
  @IsIn(EMPLOYEE_STATUSES, { message: `status must be one of: ${EMPLOYEE_STATUSES.join(', ')}` })
  status?: EmployeeStatus;

  @IsOptional()
  @IsIn(ROLES, { message: `role must be one of: ${ROLES.join(', ')}` })
  role?: Role;
}
