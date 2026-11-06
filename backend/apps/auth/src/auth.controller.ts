import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@app/shared';
import type {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResult,
  MeRequest,
  ServicePing,
} from '@app/shared';
import { AuthService } from './auth.service.js';

/** TCP handlers. Payloads were already validated by the gateway's DTOs. */
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.PING)
  ping(): Promise<ServicePing> {
    return this.authService.ping();
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() request: LoginRequest): Promise<LoginResult> {
    return this.authService.login(request);
  }

  @MessagePattern(AUTH_PATTERNS.ME)
  me(@Payload() request: MeRequest): Promise<AuthUser> {
    return this.authService.me(request);
  }

  @MessagePattern(AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(@Payload() request: ChangePasswordRequest): Promise<LoginResult> {
    return this.authService.changePassword(request);
  }
}
