import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { ServiceClientsModule } from '../clients/service-clients.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { PhotoStorageService } from './photo/photo-storage.service.js';

export const DEFAULT_UPLOAD_MAX_SIZE_MB = 5;
const BYTES_PER_MB = 1024 * 1024;

@Module({
  imports: [
    ServiceClientsModule,
    // Uploads are kept in memory (no `dest`): the photo's bytes are checked
    // before anything is written to disk. Bigger files are refused with 413.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const maxMb = Number(config.get<string>('UPLOAD_MAX_SIZE_MB') ?? DEFAULT_UPLOAD_MAX_SIZE_MB);
        if (!Number.isFinite(maxMb) || maxMb <= 0) throw new Error('UPLOAD_MAX_SIZE_MB must be a positive number');
        return { limits: { fileSize: Math.floor(maxMb * BYTES_PER_MB), files: 1, fields: 5 } };
      },
    }),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, PhotoStorageService],
})
export class AttendanceModule {}
