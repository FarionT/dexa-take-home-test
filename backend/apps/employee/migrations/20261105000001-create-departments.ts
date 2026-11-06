import type { QueryInterface } from 'sequelize';

// sequelize-cli calls up/down with (queryInterface, Sequelize module).
type SequelizeModule = typeof import('sequelize');

export async function up(qi: QueryInterface, Sequelize: SequelizeModule): Promise<void> {
  const { DataTypes } = Sequelize;
  const now = Sequelize.literal('CURRENT_TIMESTAMP');

  await qi.createTable('departments', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  });

  // 1 while live, NULL once soft-deleted: unique keys then ignore deleted rows.
  await qi.sequelize.query(
    'ALTER TABLE `departments` ADD COLUMN `not_deleted` TINYINT AS (IF(`deleted_at` IS NULL, 1, NULL)) STORED',
  );
  await qi.addIndex('departments', ['name', 'not_deleted'], {
    unique: true,
    name: 'uq_departments_name',
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.dropTable('departments');
}
