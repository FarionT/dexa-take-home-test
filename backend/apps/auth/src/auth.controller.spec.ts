import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { createPing } from '@app/shared';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

/** The controller only forwards messages; the logic is tested in auth.service.spec.ts. */
describe('AuthController', () => {
  let controller: AuthController;
  const service = {
    ping: vi.fn(),
    login: vi.fn(),
    me: vi.fn(),
    changePassword: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(service).forEach((fn) => fn.mockReset());
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('answers ping', async () => {
    service.ping.mockResolvedValue(createPing('auth', 'up'));
    expect(await controller.ping()).toMatchObject({ service: 'auth', status: 'ok', database: 'up' });
  });

  it('forwards login, me and change-password payloads', async () => {
    service.login.mockResolvedValue('login-result');
    service.me.mockResolvedValue('me-result');
    service.changePassword.mockResolvedValue('change-result');

    const login = { email: 'budi@dexa.com', password: 'Secret123' };
    const change = { user_id: 'user-1', current_password: 'Secret123', new_password: 'NewSecret456' };

    expect(await controller.login(login)).toBe('login-result');
    expect(await controller.me({ user_id: 'user-1' })).toBe('me-result');
    expect(await controller.changePassword(change)).toBe('change-result');
    expect(service.login).toHaveBeenCalledWith(login);
    expect(service.me).toHaveBeenCalledWith({ user_id: 'user-1' });
    expect(service.changePassword).toHaveBeenCalledWith(change);
  });
});
