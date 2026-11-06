import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { sequelizeOptions } from '@app/shared';
import { User } from './users/user.model.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // This service connects only to the database it owns.
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        sequelizeOptions(config, config.getOrThrow<string>('DB_AUTH_NAME')),
    }),
    SequelizeModule.forFeature([User]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
