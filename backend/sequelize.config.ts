/**
 * sequelize-cli config. Each service database is its own "environment":
 *
 *   sequelize-cli db:migrate --env auth --migrations-path apps/auth/migrations
 *
 * Use the npm scripts (db:migrate, db:migrate:status, db:migrate:undo:<service>,
 * db:seed, db:seed:undo) rather than calling the CLI directly. sequelize-cli loads this file with
 * import(), so it runs on plain Node (type stripping): erasable TS syntax only.
 * Reads process.env directly: a CLI config, outside Nest's DI.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

function forDatabase(databaseEnvVar: string) {
  return {
    dialect: 'mysql',
    host: requireEnv('DB_HOST'),
    port: Number(requireEnv('DB_PORT')),
    username: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv(databaseEnvVar),
    timezone: '+00:00',
    // Run history, stored in each service's own database.
    migrationStorageTableName: 'sequelize_meta',
    // Record executed seeders too (the CLI default is to not track them), so
    // `db:seed` runs each seeder once, like migrations.
    seederStorage: 'sequelize',
    seederStorageTableName: 'sequelize_data',
    logging: false,
  };
}

export default {
  auth: forDatabase('DB_AUTH_NAME'),
  employee: forDatabase('DB_EMPLOYEE_NAME'),
  attendance: forDatabase('DB_ATTENDANCE_NAME'),
};
