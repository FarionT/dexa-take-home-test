import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PASSWORD_MAX_BYTES, normalizeEmail } from '@app/shared';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email: string;

  // Only a length check: the password rules apply when a password is set, not at login.
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @IsByteLength(1, PASSWORD_MAX_BYTES, { message: `password must be at most ${PASSWORD_MAX_BYTES} bytes` })
  password: string;
}
