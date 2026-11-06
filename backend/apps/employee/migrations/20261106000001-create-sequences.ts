import type { QueryInterface } from 'sequelize';

// sequelize-cli calls up/down with (queryInterface, Sequelize module).
type SequelizeModule = typeof import('sequelize');

/**
 * Counters for human-readable codes (EMP-0001, EMP-0002, ...). A row is locked
 * and incremented inside the transaction that creates the record, so two HR
 * users creating employees at once get consecutive numbers, never the same one.
 * (MySQL can't derive the code from AUTO_INCREMENT: a generated column may not
 * refer to an auto-increment column, error 3109.)
 */
export async function up(qi: QueryInterface, Sequelize: SequelizeModule): Promise<void> {
  const { DataTypes } = Sequelize;
  const now = Sequelize.literal('CURRENT_TIMESTAMP');

  await qi.createTable('sequences', {
    name: { type: DataTypes.STRING(50), primaryKey: true, allowNull: false },
    last_number: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  });

  // Start after any code already in use, so existing EMP-xxxx values are never handed out again
  // (including soft-deleted employees: codes are never reused).
  await qi.sequelize.query(
    "INSERT INTO `sequences` (`name`, `last_number`) " +
      "SELECT 'employee_code', COALESCE(MAX(CAST(SUBSTRING(`employee_code`, 5) AS UNSIGNED)), 0) " +
      "FROM `employees` WHERE `employee_code` REGEXP '^EMP-[0-9]+$'",
  );
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.dropTable('sequences');
}
