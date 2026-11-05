import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { SERVICE_CLIENTS, createPing } from '@app/shared';
import type { ServiceKey } from '@app/shared';
import { HealthService } from './health.service.js';

const upClient = (key: ServiceKey) => ({ send: () => of(createPing(key)) });
const downClient = { send: () => throwError(() => new Error('Connection refused')) };

async function createService(attendanceClient: object): Promise<HealthService> {
  const module = await Test.createTestingModule({
    providers: [
      HealthService,
      { provide: SERVICE_CLIENTS.auth, useValue: upClient('auth') },
      { provide: SERVICE_CLIENTS.employee, useValue: upClient('employee') },
      { provide: SERVICE_CLIENTS.attendance, useValue: attendanceClient },
    ],
  }).compile();
  return module.get(HealthService);
}

describe('HealthService', () => {
  it('reports ok when every service answers', async () => {
    const service = await createService(upClient('attendance'));
    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.services.attendance.status).toBe('up');
  });

  it('reports degraded, not an error, when one service is down', async () => {
    const service = await createService(downClient);
    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.services.auth.status).toBe('up');
    expect(result.services.attendance).toEqual({ status: 'down', error: 'Connection refused' });
  });
});
