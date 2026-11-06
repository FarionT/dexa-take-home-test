import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EMPLOYEE_PATTERNS } from '@app/shared';
import type {
  CreateEmployeeRequest,
  DeleteEmployeeRequest,
  EmployeeListResult,
  EmployeeRecord,
  EmployeeSummary,
  FindEmployeeIdsRequest,
  FindEmployeeRequest,
  FindEmployeesByIdsRequest,
  ListEmployeesRequest,
  UpdateEmployeeRequest,
  UpdateEmployeeResult,
} from '@app/shared';
import { EmployeesService } from './employees.service.js';

/** TCP handlers. Payloads were already validated by the gateway's DTOs. */
@Controller()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @MessagePattern(EMPLOYEE_PATTERNS.CREATE)
  create(@Payload() request: CreateEmployeeRequest): Promise<EmployeeRecord> {
    return this.employeesService.create(request);
  }

  @MessagePattern(EMPLOYEE_PATTERNS.LIST)
  list(@Payload() request: ListEmployeesRequest): Promise<EmployeeListResult> {
    return this.employeesService.list(request);
  }

  @MessagePattern(EMPLOYEE_PATTERNS.FIND_ONE)
  findOne(@Payload() request: FindEmployeeRequest): Promise<EmployeeRecord> {
    return this.employeesService.findOne(request);
  }

  @MessagePattern(EMPLOYEE_PATTERNS.UPDATE)
  update(@Payload() request: UpdateEmployeeRequest): Promise<UpdateEmployeeResult> {
    return this.employeesService.update(request);
  }

  @MessagePattern(EMPLOYEE_PATTERNS.FIND_IDS)
  findIds(@Payload() request: FindEmployeeIdsRequest): Promise<string[]> {
    return this.employeesService.findIds(request);
  }

  @MessagePattern(EMPLOYEE_PATTERNS.FIND_BY_IDS)
  findByIds(@Payload() request: FindEmployeesByIdsRequest): Promise<EmployeeSummary[]> {
    return this.employeesService.findByIds(request);
  }

  @MessagePattern(EMPLOYEE_PATTERNS.DELETE)
  delete(@Payload() request: DeleteEmployeeRequest): Promise<{ id: string }> {
    return this.employeesService.delete(request);
  }
}
