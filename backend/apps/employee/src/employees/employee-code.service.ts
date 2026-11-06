import { Injectable } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import type { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

const SEQUENCE_NAME = 'employee_code';
const CODE_PREFIX = 'EMP-';
const MIN_DIGITS = 4;

/**
 * EMP-0001 ... EMP-9999, then EMP-10000. Padded to at least 4 digits and never
 * truncated (MySQL's LPAD(n, 4) would turn 10000 and 10001 both into "1000").
 */
export function formatEmployeeCode(value: number): string {
  return `${CODE_PREFIX}${String(value).padStart(MIN_DIGITS, '0')}`;
}

@Injectable()
export class EmployeeCodeService {
  constructor(private readonly sequelize: Sequelize) {}

  /**
   * Reserves the next employee code. Must be called inside the transaction that
   * creates the employee: `FOR UPDATE` locks the counter row until that
   * transaction ends, so concurrent creates wait and get consecutive numbers,
   * and a rolled-back create gives its number back.
   */
  async next(transaction: Transaction): Promise<string> {
    const rows = await this.sequelize.query<{ last_number: number }>(
      'SELECT `last_number` FROM `sequences` WHERE `name` = ? AND `deleted_at` IS NULL FOR UPDATE',
      { replacements: [SEQUENCE_NAME], type: QueryTypes.SELECT, transaction },
    );
    const current = rows[0];
    if (!current) {
      throw new Error(`Sequence "${SEQUENCE_NAME}" is missing. Run the employee migrations.`);
    }

    const value = current.last_number + 1;
    await this.sequelize.query(
      'UPDATE `sequences` SET `last_number` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `name` = ?',
      { replacements: [value, SEQUENCE_NAME], transaction },
    );
    return formatEmployeeCode(value);
  }
}
