import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@app/shared';
import type { ServicePing } from '@app/shared';
import { AuthService } from './auth.service.js';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.PING)
  ping(): Promise<ServicePing> {
    return this.authService.ping();
  }
}
