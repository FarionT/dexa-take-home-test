import type { QueryInterface } from 'sequelize';

// sequelize-cli calls up/down with (queryInterface, Sequelize module).
type SequelizeModule = typeof import('sequelize');

// Migrations are snapshots: values are written out here, not imported from app code.
export async function up(qi: QueryInterface, Sequelize: SequelizeModule): Promise<void> {
  const { DataTypes } = Sequelize;
  const now = Sequelize.literal('CURRENT_TIMESTAMP');

  await qi.createTable('users', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    employee_id: { type: DataTypes.UUID, allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('ADMIN', 'EMPLOYEE'), allowNull: false, defaultValue: 'EMPLOYEE' },
    must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    password_changed_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  });

  // 1 while live, NULL once soft-deleted: unique keys then ignore deleted rows.
  await qi.sequelize.query(
    'ALTER TABLE `users` ADD COLUMN `not_deleted` TINYINT AS (IF(`deleted_at` IS NULL, 1, NULL)) STORED',
  );
  await qi.addIndex('users', ['email', 'not_deleted'], { unique: true, name: 'uq_users_email' });
  await qi.addIndex('users', ['employee_id', 'not_deleted'], {
    unique: true,
    name: 'uq_users_employee_id',
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.dropTable('users');
}
