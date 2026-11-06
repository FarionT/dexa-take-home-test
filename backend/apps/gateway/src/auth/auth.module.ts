import { Module } from '@nestjs/common';
import { ServiceClientsModule } from '../clients/service-clients.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [ServiceClientsModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
