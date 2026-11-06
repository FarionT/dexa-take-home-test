import type { Optional } from 'sequelize';
import {
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

export interface DepartmentAttributes {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type DepartmentCreationAttributes = Optional<
  DepartmentAttributes,
  'id' | 'created_at' | 'updated_at' | 'deleted_at'
>;

/**
 * Table `departments` in dexa_employee. See docs/database-design.md.
 *
 * No `@HasMany(() => Employee)` on purpose: employee.model.ts imports this file,
 * and a two-way import makes ESM load one model before the other is defined
 * (decorator metadata reads the class at load time -> ReferenceError).
 * Query from Employee (`include: [Department]`) instead.
 */
@Table({ tableName: 'departments' })
export class Department extends Model<DepartmentAttributes, DepartmentCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name: string;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;

  @DeletedAt
  deleted_at: Date | null;
}
