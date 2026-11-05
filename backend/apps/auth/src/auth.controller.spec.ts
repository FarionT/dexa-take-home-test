import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService],
    }).compile();

    controller = module.get(AuthController);
  });

  it('answers ping with its service name', () => {
    expect(controller.ping()).toMatchObject({ service: 'auth', status: 'ok' });
  });
});
