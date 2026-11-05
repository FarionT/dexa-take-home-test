import { Injectable } from '@nestjs/common';
import { createPing } from '@app/shared';
import type { ServicePing } from '@app/shared';

@Injectable()
export class AuthService {
  ping(): ServicePing {
    return createPing('auth');
  }
}
