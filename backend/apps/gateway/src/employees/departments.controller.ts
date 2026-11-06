import { Controller, Get, Inject } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { EMPLOYEE_PATTERNS, SERVICE_CLIENTS } from '@app/shared';
import type { DepartmentRecord } from '@app/shared';
import { Roles } from '../auth/auth.decorators.js';
import { sendToService } from '../clients/rpc.js';
import { ResponseMessage } from '../common/api-response.js';

/** The department choices for the employee form (HR only). */
@Roles('ADMIN')
@Controller('departments')
export class DepartmentsController {
  constructor(@Inject(SERVICE_CLIENTS.employee) private readonly employeeClient: ClientProxy) {}

  @Get()
  @ResponseMessage('Departments')
  list(): Promise<DepartmentRecord[]> {
    return sendToService<DepartmentRecord[], Record<string, never>>(
      this.employeeClient,
      EMPLOYEE_PATTERNS.LIST_DEPARTMENTS,
      {},
    );
  }
}
