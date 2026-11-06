import { Module } from '@nestjs/common';
import { ServiceClientsModule } from '../clients/service-clients.module.js';
import { DepartmentsController } from './departments.controller.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [ServiceClientsModule],
  controllers: [EmployeesController, DepartmentsController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
