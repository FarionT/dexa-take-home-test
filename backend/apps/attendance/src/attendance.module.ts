import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { sequelizeOptions } from '@app/shared';
import { Attendance } from './attendances/attendance.model.js';
import { AttendancesController } from './attendances/attendances.controller.js';
import { AttendancesService } from './attendances/attendances.service.js';
import { PingController } from './ping.controller.js';
import { PingService } from './ping.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // This service connects only to the database it owns.
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        sequelizeOptions(config, config.getOrThrow<string>('DB_ATTENDANCE_NAME')),
    }),
    SequelizeModule.forFeature([Attendance]),
  ],
  controllers: [PingController, AttendancesController],
  providers: [PingService, AttendancesService],
})
export class AttendanceModule {}
