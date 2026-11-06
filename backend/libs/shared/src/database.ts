import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SequelizeModuleOptions } from '@nestjs/sequelize';
import type { Sequelize } from 'sequelize-typescript';

/**
 * Sequelize connection options shared by every service. Each service passes
 * the name of the database it owns (e.g. DB_AUTH_NAME).
 */
export function sequelizeOptions(config: ConfigService, database: string): SequelizeModuleOptions {
  return {
    dialect: 'mysql',
    host: config.getOrThrow<string>('DB_HOST'),
    port: Number(config.getOrThrow<string>('DB_PORT')),
    username: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database,
    // Store every DATETIME in UTC; the business day is computed in Asia/Jakarta by the app.
    timezone: '+00:00',
    autoLoadModels: true,
    // The schema is owned by migrations only. Never let Sequelize create or alter tables.
    synchronize: false,
    logging: false,
    define: {
      // Data fields are snake_case in code too (user.employee_id), so attribute
      // names already match the columns. These rename Sequelize's default
      // createdAt / updatedAt / deletedAt attributes to match.
      timestamps: true,
      paranoid: true, // soft delete via deleted_at
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    },
  };
}

/**
 * Must stay below the gateway's ping timeout (2s), so a hanging database is
 * reported as "service up, database down" instead of the whole service timing out.
 */
const DB_CHECK_TIMEOUT_MS = 1000;

/** Pings the database. Failures are logged and reported, not thrown. */
export async function checkDatabase(
  sequelize: Pick<Sequelize, 'authenticate'>,
  logger: Logger,
  timeoutMs: number = DB_CHECK_TIMEOUT_MS,
): Promise<'up' | 'down'> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    await Promise.race([sequelize.authenticate(), timeout]);
    return 'up';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Database check failed: ${message}`);
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
