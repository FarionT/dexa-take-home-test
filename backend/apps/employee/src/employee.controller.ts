import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { EMPLOYEE_PATTERNS } from '@app/shared';
import type { ServicePing } from '@app/shared';
import { EmployeeService } from './employee.service.js';

@Controller()
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @MessagePattern(EMPLOYEE_PATTERNS.PING)
  ping(): ServicePing {
    return this.employeeService.ping();
  }
}
