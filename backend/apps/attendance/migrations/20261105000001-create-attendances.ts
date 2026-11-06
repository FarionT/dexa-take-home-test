import type { QueryInterface } from 'sequelize';

// sequelize-cli calls up/down with (queryInterface, Sequelize module).
type SequelizeModule = typeof import('sequelize');

// Migrations are snapshots: values are written out here, not imported from app code.
export async function up(qi: QueryInterface, Sequelize: SequelizeModule): Promise<void> {
  const { DataTypes } = Sequelize;
  const now = Sequelize.literal('CURRENT_TIMESTAMP');

  await qi.createTable('attendances', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    // Logical ref to dexa_employee.employees.id: no FK across databases.
    employee_id: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM('CHECK_IN', 'CHECK_OUT'), allowNull: false },
    attendance_date: { type: DataTypes.DATEONLY, allowNull: false },
    recorded_at: { type: DataTypes.DATE(3), allowNull: false },
    photo_path: { type: DataTypes.STRING(255), allowNull: false },
    photo_mime: { type: DataTypes.STRING(50), allowNull: false },
    photo_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    notes: { type: DataTypes.STRING(255), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  });

  // 1 while live, NULL once soft-deleted: unique keys then ignore deleted rows.
  await qi.sequelize.query(
    'ALTER TABLE `attendances` ADD COLUMN `not_deleted` TINYINT AS (IF(`deleted_at` IS NULL, 1, NULL)) STORED',
  );
  // One live check-in and one live check-out per employee per day.
  await qi.addIndex('attendances', ['employee_id', 'attendance_date', 'type', 'not_deleted'], {
    unique: true,
    name: 'uq_attendance_employee_day_type',
  });
  await qi.addIndex('attendances', ['attendance_date'], { name: 'idx_attendance_date' });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.dropTable('attendances');
}
