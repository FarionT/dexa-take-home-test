import type { Optional } from 'sequelize';
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { EMPLOYEE_STATUSES } from '@app/shared';
import type { EmployeeStatus } from '@app/shared';
import { Department } from '../departments/department.model.js';

export interface EmployeeAttributes {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  position: string;
  department_id: string;
  hire_date: string; // DATEONLY: 'YYYY-MM-DD'
  status: EmployeeStatus;
  /** HR employee who created / last updated this row. NULL only for seeded rows. */
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type EmployeeCreationAttributes = Optional<
  EmployeeAttributes,
  'id' | 'phone' | 'status' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at' | 'deleted_at'
>;

/** Table `employees` in dexa_employee. See docs/database-design.md. */
@Table({ tableName: 'employees' })
export class Employee extends Model<EmployeeAttributes, EmployeeCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  employee_code: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  full_name: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  email: string;

  @Column({ type: DataType.STRING(20), allowNull: true })
  phone: string | null;

  @Column({ type: DataType.STRING(100), allowNull: false })
  position: string;

  @ForeignKey(() => Department)
  @Column({ type: DataType.UUID, allowNull: false })
  department_id: string;

  @BelongsTo(() => Department)
  department: Department;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  hire_date: string;

  @Default('ACTIVE')
  @Column({ type: DataType.ENUM(...EMPLOYEE_STATUSES), allowNull: false })
  status: EmployeeStatus;

  // Self-referencing FKs (same database). Kept as plain columns: no association
  // is needed yet, and the FK constraint itself lives in the migration.
  @Column({ type: DataType.UUID, allowNull: true })
  created_by: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  updated_by: string | null;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;

  @DeletedAt
  deleted_at: Date | null;
}
