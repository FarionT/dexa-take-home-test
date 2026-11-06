import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ATTENDANCE_PATTERNS } from '@app/shared';
import type { ServicePing } from '@app/shared';
import { PingService } from './ping.service.js';

/** Health check: the gateway's GET /health sends this to every service. */
@Controller()
export class PingController {
  constructor(private readonly pingService: PingService) {}

  @MessagePattern(ATTENDANCE_PATTERNS.PING)
  ping(): Promise<ServicePing> {
    return this.pingService.ping();
  }
}
