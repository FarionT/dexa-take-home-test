import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { EmployeeController } from './employee.controller.js';
import { EmployeeService } from './employee.service.js';

describe('EmployeeController', () => {
  let controller: EmployeeController;
  const authenticate = vi.fn<() => Promise<void>>();

  beforeEach(async () => {
    authenticate.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [EmployeeService, { provide: Sequelize, useValue: { authenticate } }],
    }).compile();

    controller = module.get(EmployeeController);
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
