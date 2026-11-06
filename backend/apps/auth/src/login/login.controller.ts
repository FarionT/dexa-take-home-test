import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@app/shared';
import type {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResult,
  MeRequest,
} from '@app/shared';
import { LoginService } from './login.service.js';

/** TCP handlers for logging in and the logged-in user. Payloads were already validated by the gateway's DTOs. */
@Controller()
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() request: LoginRequest): Promise<LoginResult> {
    return this.loginService.login(request);
  }

  @MessagePattern(AUTH_PATTERNS.ME)
  me(@Payload() request: MeRequest): Promise<AuthUser> {
    return this.loginService.me(request);
  }

  @MessagePattern(AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(@Payload() request: ChangePasswordRequest): Promise<LoginResult> {
    return this.loginService.changePassword(request);
  }
}
