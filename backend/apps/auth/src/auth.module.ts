import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { getJwtSecret, sequelizeOptions } from '@app/shared';
import { User } from './users/user.model.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './passwords/password.service.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

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
    // Signs tokens at login; the gateway verifies them with the same secret.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: getJwtSecret(config) }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, PasswordService, UsersService],
})
export class AuthModule {}
