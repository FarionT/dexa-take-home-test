import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  ATTENDANCE_PATTERNS,
  AUTH_PATTERNS,
  EMPLOYEE_PATTERNS,
  SERVICE_CLIENTS,
} from '@app/shared';
import type { ServicePing } from '@app/shared';
import type { HealthResponse, ServiceStatus } from './health.types.js';

const PING_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(SERVICE_CLIENTS.auth) private readonly authClient: ClientProxy,
    @Inject(SERVICE_CLIENTS.employee) private readonly employeeClient: ClientProxy,
    @Inject(SERVICE_CLIENTS.attendance) private readonly attendanceClient: ClientProxy,
  ) {}

  /** Pings every service in parallel. A down service is reported, not thrown. */
  async check(): Promise<HealthResponse> {
    const [auth, employee, attendance] = await Promise.all([
      this.ping('auth', this.authClient, AUTH_PATTERNS.PING),
      this.ping('employee', this.employeeClient, EMPLOYEE_PATTERNS.PING),
      this.ping('attendance', this.attendanceClient, ATTENDANCE_PATTERNS.PING),
    ]);
    const allUp = [auth, employee, attendance].every(
      (s) => s.status === 'up' && s.database === 'up',
    );

    return {
      status: allUp ? 'ok' : 'degraded',
      services: { auth, employee, attendance },
    };
  }

  private async ping(name: string, client: ClientProxy, pattern: string): Promise<ServiceStatus> {
    try {
      const reply = await firstValueFrom(
        client.send<ServicePing>(pattern, {}).pipe(timeout(PING_TIMEOUT_MS)),
      );
      return { status: 'up', database: reply.database, uptime_seconds: reply.uptime_seconds };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`${name} service did not answer ping: ${message}`);
      return { status: 'down', error: message };
    }
  }
}
