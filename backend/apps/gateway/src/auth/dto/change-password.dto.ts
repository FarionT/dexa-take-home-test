import { IsByteLength, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '@app/shared';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'current_password is required' })
  @IsByteLength(1, PASSWORD_MAX_BYTES, { message: `current_password must be at most ${PASSWORD_MAX_BYTES} bytes` })
  current_password: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `new_password must be at least ${PASSWORD_MIN_LENGTH} characters` })
  // bcrypt ignores everything after 72 bytes; reject instead of silently cutting the password.
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: `new_password must be at most ${PASSWORD_MAX_BYTES} bytes` })
  @Matches(/[A-Za-z]/, { message: 'new_password must contain a letter' })
  @Matches(/\d/, { message: 'new_password must contain a number' })
  new_password: string;
}
