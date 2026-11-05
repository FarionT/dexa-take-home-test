import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

describe('AttendanceController', () => {
  let controller: AttendanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [AttendanceService],
    }).compile();

    controller = module.get(AttendanceController);
  });

  it('answers ping with its service name', () => {
    expect(controller.ping()).toMatchObject({ service: 'attendance', status: 'ok' });
  });
});
