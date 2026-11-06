import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { JwtPayload, TemporaryPasswordResult } from '@app/shared';
import { AllowDuringPasswordChange, CurrentUser, Roles } from '../auth/auth.decorators.js';
import { ResponseMessage } from '../common/api-response.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { ListEmployeesQueryDto } from './dto/list-employees.query.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeesService } from './employees.service.js';
import type { CreatedEmployeeView, EmployeeListView, EmployeeView, UpdatedEmployeeView } from './employees.types.js';

/** HR (ADMIN) manages employees and their logins. Docs: docs/api/employees.md */
@Roles('ADMIN')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ResponseMessage('Employees')
  list(@Query() query: ListEmployeesQueryDto): Promise<EmployeeListView> {
    return this.employeesService.list(query);
  }

  /** Any logged-in user: their own profile. Declared before ':id' so "me" isn't read as an id. */
  @Roles('EMPLOYEE')
  @AllowDuringPasswordChange()
  @Get('me')
  @ResponseMessage('My profile')
  me(@CurrentUser() user: JwtPayload): Promise<EmployeeView> {
    return this.employeesService.findOne(user.employee_id);
  }

  @Get(':id')
  @ResponseMessage('Employee')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeView> {
    return this.employeesService.findOne(id);
  }

  @Post()
  @ResponseMessage('Employee created')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: JwtPayload): Promise<CreatedEmployeeView> {
    return this.employeesService.create(dto, user);
  }

  @Patch(':id')
  @ResponseMessage('Employee updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<UpdatedEmployeeView> {
    return this.employeesService.update(id, dto, user);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset')
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<TemporaryPasswordResult> {
    return this.employeesService.resetPassword(id, user);
  }

  /** For records created by mistake. Resignations use PATCH status INACTIVE. */
  @Delete(':id')
  @ResponseMessage('Employee deleted')
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.employeesService.delete(id, user);
  }
}
