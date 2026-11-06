import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

/** bcrypt cost factor: 2^12 rounds, about 0.2s per hash. Stored inside each hash. */
const BCRYPT_ROUNDS = 12;

/**
 * bcrypt hash (cost 12) of a random value nobody knows. Used when a login email
 * doesn't exist, so an unknown email takes as long to reject as a wrong password
 * and response times don't reveal which emails have accounts.
 */
const DUMMY_HASH = '$2b$12$qn/hC4hE5Hi8Z33BQ48ihecXh5XI9ruIA4X3nr1SWXYvD8b9FARs6';

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, BCRYPT_ROUNDS);
  }

  /** Compares against the dummy hash when there is no stored hash; the result is then always false. */
  async verify(plain: string, passwordHash: string | undefined): Promise<boolean> {
    const matches = await compare(plain, passwordHash ?? DUMMY_HASH);
    return passwordHash !== undefined && matches;
  }
}
