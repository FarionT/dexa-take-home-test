import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { EmployeeController } from './employee.controller.js';
import { EmployeeService } from './employee.service.js';

describe('EmployeeController', () => {
  let controller: EmployeeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [EmployeeService],
    }).compile();

    controller = module.get(EmployeeController);
  });

  it('answers ping with its service name', () => {
    expect(controller.ping()).toMatchObject({ service: 'employee', status: 'ok' });
  });
});
