import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { EMPLOYEE_PATTERNS } from '@app/shared';
import type { DepartmentRecord } from '@app/shared';
import { DepartmentsService } from './departments.service.js';

@Controller()
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @MessagePattern(EMPLOYEE_PATTERNS.LIST_DEPARTMENTS)
  list(): Promise<DepartmentRecord[]> {
    return this.departmentsService.list();
  }
}
