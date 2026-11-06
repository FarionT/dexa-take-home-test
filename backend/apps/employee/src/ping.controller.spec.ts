import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { PingController } from './ping.controller.js';
import { PingService } from './ping.service.js';

describe('PingController', () => {
  let controller: PingController;
  const authenticate = vi.fn<() => Promise<void>>();

  beforeEach(async () => {
    authenticate.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PingController],
      providers: [PingService, { provide: Sequelize, useValue: { authenticate } }],
    }).compile();

    controller = module.get(PingController);
  });

  it('answers ping with its service name and database up', async () => {
    authenticate.mockResolvedValue();
    expect(await controller.ping()).toMatchObject({ service: 'employee', status: 'ok', database: 'up' });
  });

  it('still answers ping when the database is down', async () => {
    authenticate.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await controller.ping()).toMatchObject({ service: 'employee', status: 'ok', database: 'down' });
  });
});
