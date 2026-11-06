import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@app/shared';
import type {
  AccountActionRequest,
  CreateUserRequest,
  CreateUserResult,
  EmployeeAccount,
  FindAccountsRequest,
  RestoreUserRequest,
  TemporaryPasswordResult,
  UpdateAccountRequest,
  UpdateAccountResult,
} from '@app/shared';
import { UsersService } from './users.service.js';

/** Account management messages, sent by the gateway's employee endpoints. */
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(AUTH_PATTERNS.CREATE_USER)
  create(@Payload() request: CreateUserRequest): Promise<CreateUserResult> {
    return this.usersService.create(request);
  }

  @MessagePattern(AUTH_PATTERNS.FIND_ACCOUNTS)
  findAccounts(@Payload() request: FindAccountsRequest): Promise<EmployeeAccount[]> {
    return this.usersService.findAccounts(request);
  }

  @MessagePattern(AUTH_PATTERNS.UPDATE_ACCOUNT)
  updateAccount(@Payload() request: UpdateAccountRequest): Promise<UpdateAccountResult> {
    return this.usersService.updateAccount(request);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() request: AccountActionRequest): Promise<TemporaryPasswordResult> {
    return this.usersService.resetPassword(request);
  }

  @MessagePattern(AUTH_PATTERNS.DELETE_USER)
  delete(@Payload() request: AccountActionRequest): Promise<{ deleted: boolean }> {
    return this.usersService.delete(request);
  }

  @MessagePattern(AUTH_PATTERNS.RESTORE_USER)
  restore(@Payload() request: RestoreUserRequest): Promise<{ restored: boolean }> {
    return this.usersService.restore(request);
  }
}
