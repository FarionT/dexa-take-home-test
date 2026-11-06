import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { normalizeEmail, rpcError } from '@app/shared';
import type {
  AuthUser,
  ChangePasswordRequest,
  CheckSessionRequest,
  JwtPayload,
  LoginRequest,
  LoginResult,
  MeRequest,
} from '@app/shared';
import { PasswordService } from '../passwords/password.service.js';
import { parseDurationToSeconds } from '../tokens/token-lifetime.js';
import { User } from '../users/user.model.js';

// Same message for an unknown email and a wrong password: don't reveal which emails exist.
const INVALID_CREDENTIALS = 'Invalid email or password';
const SESSION_INVALID = 'Your session is no longer valid. Please log in again.';

/** Login, the logged-in user (`me`) and changing the own password. Signs the JWTs. */
@Injectable()
export class LoginService {
  private readonly tokenLifetimeSeconds: number;

  constructor(
    @InjectModel(User) private readonly users: typeof User,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.tokenLifetimeSeconds = parseDurationToSeconds(config.getOrThrow<string>('JWT_EXPIRES_IN'));
  }

  async login(request: LoginRequest): Promise<LoginResult> {
    const user = await this.users.findOne({ where: { email: normalizeEmail(request.email) } });
    // bcrypt runs even when the email is unknown, so response time doesn't reveal it.
    const passwordMatches = await this.passwords.verify(request.password, user?.password_hash);
    if (!user || !passwordMatches) {
      throw rpcError(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
    }
    // Checked only after a correct password, so this doesn't reveal accounts either.
    if (!user.is_active) {
      throw rpcError(HttpStatus.FORBIDDEN, 'This account is deactivated. Please contact HR.');
    }

    await user.update({ last_login_at: new Date() });
    return this.issueToken(user);
  }

  /**
   * The gateway asks this on every authenticated request. A valid signature
   * only proves who issued the token; this says whether the login still exists,
   * is active, and which role and password state it has right now.
   */
  async checkSession(request: CheckSessionRequest): Promise<JwtPayload> {
    return toClaims(await this.findActiveUser(request.user_id));
  }

  async me(request: MeRequest): Promise<AuthUser> {
    return toAuthUser(await this.findActiveUser(request.user_id));
  }

  /** Returns a new token: the old one still carries must_change_password = true. */
  async changePassword(request: ChangePasswordRequest): Promise<LoginResult> {
    const user = await this.findActiveUser(request.user_id);

    if (!(await this.passwords.verify(request.current_password, user.password_hash))) {
      throw rpcError(HttpStatus.BAD_REQUEST, 'Current password is incorrect');
    }
    if (await this.passwords.verify(request.new_password, user.password_hash)) {
      throw rpcError(HttpStatus.BAD_REQUEST, 'New password must be different from the current one');
    }

    await user.update({
      password_hash: await this.passwords.hash(request.new_password),
      must_change_password: false,
      password_changed_at: new Date(),
    });
    return this.issueToken(user);
  }

  /** A deleted or deactivated user's token is still signed, so check the database. */
  private async findActiveUser(userId: string): Promise<User> {
    const user = await this.users.findByPk(userId);
    if (!user || !user.is_active) {
      throw rpcError(HttpStatus.UNAUTHORIZED, SESSION_INVALID);
    }
    return user;
  }

  private async issueToken(user: User): Promise<LoginResult> {
    const accessToken = await this.jwt.signAsync(toClaims(user), { expiresIn: this.tokenLifetimeSeconds });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.tokenLifetimeSeconds,
      user: toAuthUser(user),
    };
  }
}

/** The JWT claims of a user; also the reply of check-session. */
function toClaims(user: User): JwtPayload {
  return {
    sub: user.id,
    employee_id: user.employee_id,
    role: user.role,
    must_change_password: user.must_change_password,
  };
}

/** The public shape of a user: never includes password_hash. */
function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    employee_id: user.employee_id,
    email: user.email,
    role: user.role,
    must_change_password: user.must_change_password,
    last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null,
  };
}
