import { Injectable, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { checkDatabase, createPing } from '@app/shared';
import type { ServicePing } from '@app/shared';

@Injectable()
export class PingService {
  private readonly logger = new Logger(PingService.name);

  constructor(private readonly sequelize: Sequelize) {}

  async ping(): Promise<ServicePing> {
    return createPing('auth', await checkDatabase(this.sequelize, this.logger));
  }
}
