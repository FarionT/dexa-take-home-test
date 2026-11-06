import { Logger } from '@nestjs/common';
import { checkDatabase } from './database.js';

describe('checkDatabase', () => {
  const logger = new Logger('test');
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('returns up when the database answers', async () => {
    const sequelize = { authenticate: () => Promise.resolve() };
    expect(await checkDatabase(sequelize, logger)).toBe('up');
  });

  it('returns down and logs when the database refuses', async () => {
    const sequelize = { authenticate: () => Promise.reject(new Error('ECONNREFUSED')) };
    expect(await checkDatabase(sequelize, logger)).toBe('down');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('returns down when the database hangs past the timeout', async () => {
    const sequelize = { authenticate: () => new Promise<void>(() => undefined) };
    expect(await checkDatabase(sequelize, logger, 20)).toBe('down');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no answer within 20ms'));
  });
});
