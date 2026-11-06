import { Test } from '@nestjs/testing';
import type { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { EmployeeCodeService, formatEmployeeCode } from './employee-code.service.js';

describe('formatEmployeeCode', () => {
  it.each([
    [1, 'EMP-0001'],
    [42, 'EMP-0042'],
    [9999, 'EMP-9999'],
    [10000, 'EMP-10000'],
    [10001, 'EMP-10001'],
  ])('formats %i as %s', (value, code) => {
    expect(formatEmployeeCode(value)).toBe(code);
  });
});

describe('EmployeeCodeService', () => {
  const query = vi.fn();
  const transaction = {} as Transaction; // only passed through to sequelize.query
  let service: EmployeeCodeService;

  beforeEach(async () => {
    query.mockReset();
    const module = await Test.createTestingModule({
      providers: [EmployeeCodeService, { provide: Sequelize, useValue: { query } }],
    }).compile();
    service = module.get(EmployeeCodeService);
  });

  it('locks the counter, increments it and returns the formatted code', async () => {
    query.mockResolvedValueOnce([{ last_number: 41 }]).mockResolvedValueOnce([]);

    expect(await service.next(transaction)).toBe('EMP-0042');
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FOR UPDATE'),
      expect.objectContaining({ transaction }),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE `sequences`'),
      expect.objectContaining({ replacements: [42, 'employee_code'], transaction }),
    );
  });

  it('fails clearly when the counter row is missing', async () => {
    query.mockResolvedValueOnce([]);

    await expect(service.next(transaction)).rejects.toThrow('Sequence "employee_code" is missing');
  });
});
