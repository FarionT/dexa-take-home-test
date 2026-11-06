import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { sequelizeOptions } from '@app/shared';
import { Department } from './departments/department.model.js';
import { EmployeeCodeService } from './employees/employee-code.service.js';
import { Employee } from './employees/employee.model.js';
import { EmployeeController } from './employee.controller.js';
import { EmployeeService } from './employee.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // This service connects only to the database it owns.
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        sequelizeOptions(config, config.getOrThrow<string>('DB_EMPLOYEE_NAME')),
    }),
    SequelizeModule.forFeature([Department, Employee]),
  ],
  controllers: [EmployeeController],
  providers: [EmployeeService, EmployeeCodeService],
})
export class EmployeeModule {}
