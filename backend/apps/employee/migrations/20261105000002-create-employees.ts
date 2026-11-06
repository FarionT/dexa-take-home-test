import type { QueryInterface } from 'sequelize';

// sequelize-cli calls up/down with (queryInterface, Sequelize module).
type SequelizeModule = typeof import('sequelize');

// Migrations are snapshots: values are written out here, not imported from app code.
export async function up(qi: QueryInterface, Sequelize: SequelizeModule): Promise<void> {
  const { DataTypes } = Sequelize;
  const now = Sequelize.literal('CURRENT_TIMESTAMP');

  await qi.createTable('employees', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    employee_code: { type: DataTypes.STRING(20), allowNull: false },
    full_name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    position: { type: DataTypes.STRING(100), allowNull: false },
    department_id: { type: DataTypes.UUID, allowNull: false },
    hire_date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: false, defaultValue: 'ACTIVE' },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  });

  // 1 while live, NULL once soft-deleted: unique keys then ignore deleted rows.
  await qi.sequelize.query(
    'ALTER TABLE `employees` ADD COLUMN `not_deleted` TINYINT AS (IF(`deleted_at` IS NULL, 1, NULL)) STORED',
  );
  await qi.addIndex('employees', ['employee_code', 'not_deleted'], {
    unique: true,
    name: 'uq_employees_code',
  });
  await qi.addIndex('employees', ['email', 'not_deleted'], {
    unique: true,
    name: 'uq_employees_email',
  });
  await qi.addIndex('employees', ['full_name'], { name: 'idx_employees_name' });

  // Indexes first, then FKs: MySQL reuses these named indexes for the constraints
  // instead of creating its own.
  await qi.addIndex('employees', ['department_id'], { name: 'idx_employees_department' });
  await qi.addIndex('employees', ['created_by'], { name: 'idx_employees_created_by' });
  await qi.addIndex('employees', ['updated_by'], { name: 'idx_employees_updated_by' });

  await qi.addConstraint('employees', {
    type: 'foreign key',
    name: 'fk_employees_department',
    fields: ['department_id'],
    references: { table: 'departments', field: 'id' },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  await qi.addConstraint('employees', {
    type: 'foreign key',
    name: 'fk_employees_created_by',
    fields: ['created_by'],
    references: { table: 'employees', field: 'id' },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  await qi.addConstraint('employees', {
    type: 'foreign key',
    name: 'fk_employees_updated_by',
    fields: ['updated_by'],
    references: { table: 'employees', field: 'id' },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.dropTable('employees');
}
