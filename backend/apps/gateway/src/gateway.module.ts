import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '@app/shared';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { PasswordChangeGuard } from './auth/guards/password-change.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { EmployeesModule } from './employees/employees.module.js';
import { ResponseEnvelopeInterceptor } from './common/response-envelope.interceptor.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Verifies tokens signed by the auth service (same JWT_SECRET).
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: getJwtSecret(config) }),
    }),
    HealthModule,
    AuthModule,
    EmployeesModule,
  ],
  providers: [
    // Validates every request body against its DTO; unknown fields are rejected.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    },
    // Every response, success or error, is { status, message, data? }.
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // Global guards, run in this order: who are you -> password change pending? -> allowed role?
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class GatewayModule {}
