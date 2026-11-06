import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { of } from 'rxjs';
import { SERVICE_CLIENTS, SERVICE_KEYS, createPing } from '@app/shared';
import { GatewayModule } from '../src/gateway.module.js';

describe('Gateway (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    let builder = Test.createTestingModule({ imports: [GatewayModule] });
    // Replace the real TCP clients so the test does not need the services running.
    for (const key of SERVICE_KEYS) {
      builder = builder
        .overrideProvider(SERVICE_CLIENTS[key])
        .useValue({ send: () => of(createPing(key, 'up')) });
    }
    app = (await builder.compile()).createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health reports every service', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      services: {
        auth: { status: 'up' },
        employee: { status: 'up' },
        attendance: { status: 'up' },
      },
    });
  });
});
