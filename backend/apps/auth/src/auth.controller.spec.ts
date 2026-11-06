import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  const authenticate = vi.fn<() => Promise<void>>();

  beforeEach(async () => {
    authenticate.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService, { provide: Sequelize, useValue: { authenticate } }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('answers ping with its service name and database up', async () => {
    authenticate.mockResolvedValue();
    expect(await controller.ping()).toMatchObject({ service: 'auth', status: 'ok', database: 'up' });
  });

  it('still answers ping when the database is down', async () => {
    authenticate.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await controller.ping()).toMatchObject({ service: 'auth', status: 'ok', database: 'down' });
  });
});
