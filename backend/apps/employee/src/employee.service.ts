import { Injectable } from '@nestjs/common';
import { createPing } from '@app/shared';
import type { ServicePing } from '@app/shared';

@Injectable()
export class EmployeeService {
  ping(): ServicePing {
    return createPing('employee');
  }
}
