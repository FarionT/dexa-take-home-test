import { Inject, Injectable } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { AUTH_PATTERNS, SERVICE_CLIENTS } from '@app/shared';
import type {
  AuthUser,
  ChangePasswordRequest,
  JwtPayload,
  LoginRequest,
  LoginResult,
  MeRequest,
} from '@app/shared';
import { sendToService } from '../clients/rpc.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';

/** Forwards auth requests to the auth service. The user id always comes from the token. */
@Injectable()
export class AuthService {
  constructor(@Inject(SERVICE_CLIENTS.auth) private readonly authClient: ClientProxy) {}

  login(dto: LoginDto): Promise<LoginResult> {
    return sendToService<LoginResult, LoginRequest>(this.authClient, AUTH_PATTERNS.LOGIN, {
      email: dto.email,
      password: dto.password,
    });
  }

  me(user: JwtPayload): Promise<AuthUser> {
    return sendToService<AuthUser, MeRequest>(this.authClient, AUTH_PATTERNS.ME, { user_id: user.sub });
  }

  changePassword(user: JwtPayload, dto: ChangePasswordDto): Promise<LoginResult> {
    return sendToService<LoginResult, ChangePasswordRequest>(this.authClient, AUTH_PATTERNS.CHANGE_PASSWORD, {
      user_id: user.sub,
      current_password: dto.current_password,
      new_password: dto.new_password,
    });
  }
}
