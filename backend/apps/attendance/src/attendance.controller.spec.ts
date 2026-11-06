import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

describe('AttendanceController', () => {
  let controller: AttendanceController;
  const authenticate = vi.fn<() => Promise<void>>();

  beforeEach(async () => {
    authenticate.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [AttendanceService, { provide: Sequelize, useValue: { authenticate } }],
    }).compile();

    controller = module.get(AttendanceController);
  });

  it('answers ping with its service name and database up', async () => {
    authenticate.mockResolvedValue();
    expect(await controller.ping()).toMatchObject({ service: 'attendance', status: 'ok', database: 'up' });
  });

  it('still answers ping when the database is down', async () => {
    authenticate.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await controller.ping()).toMatchObject({ service: 'attendance', status: 'ok', database: 'down' });
  });
});
