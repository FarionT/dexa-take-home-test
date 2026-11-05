import { Module } from '@nestjs/common';
import { ServiceClientsModule } from '../clients/service-clients.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [ServiceClientsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
