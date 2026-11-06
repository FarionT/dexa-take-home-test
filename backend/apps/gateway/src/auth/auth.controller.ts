import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthUser, JwtPayload, LoginResult } from '@app/shared';
import { ResponseMessage } from '../common/api-response.js';
import { AllowDuringPasswordChange, CurrentUser, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @AllowDuringPasswordChange()
  @Get('me')
  @ResponseMessage('Current user')
  me(@CurrentUser() user: JwtPayload): Promise<AuthUser> {
    return this.authService.me(user);
  }

  /** Returns a new token, because the current one may still say must_change_password. */
  @AllowDuringPasswordChange()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password changed')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto): Promise<LoginResult> {
    return this.authService.changePassword(user, dto);
  }
}
