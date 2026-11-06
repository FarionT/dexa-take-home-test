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
import { ROLES } from '@app/shared';
import type { Role } from '@app/shared';

export interface UserAttributes {
  id: string;
  /** Logical ref to employees.id in dexa_employee (no FK across databases). */
  employee_id: string;
  email: string;
  password_hash: string;
  role: Role;
  must_change_password: boolean;
  password_changed_at: Date | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  | 'id'
  | 'role'
  | 'must_change_password'
  | 'password_changed_at'
  | 'is_active'
  | 'last_login_at'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
>;

/** Table `users` in dexa_auth. See docs/database-design.md. */
@Table({ tableName: 'users' })
export class User extends Model<UserAttributes, UserCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  employee_id: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  email: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  password_hash: string;

  @Default('EMPLOYEE')
  @Column({ type: DataType.ENUM(...ROLES), allowNull: false })
  role: Role;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  must_change_password: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  password_changed_at: Date | null;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  is_active: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  last_login_at: Date | null;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;

  @DeletedAt
  deleted_at: Date | null;
}
