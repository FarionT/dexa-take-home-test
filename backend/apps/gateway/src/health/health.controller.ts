import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { ResponseMessage } from '../common/api-response.js';
import { HealthService } from './health.service.js';
import type { HealthResponse } from './health.types.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ResponseMessage('Service health')
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
