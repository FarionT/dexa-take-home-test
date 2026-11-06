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
import { ATTENDANCE_TYPES } from '@app/shared';
import type { AttendanceType } from '@app/shared';

export interface AttendanceAttributes {
  id: string;
  /** Logical ref to employees.id in dexa_employee, always taken from the JWT. */
  employee_id: string;
  type: AttendanceType;
  /** Working day in Asia/Jakarta ('YYYY-MM-DD'), computed by the server. */
  attendance_date: string;
  /** Exact time (UTC), set by the server, never by the client. */
  recorded_at: Date;
  photo_path: string;
  photo_mime: string;
  photo_size: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type AttendanceCreationAttributes = Optional<
  AttendanceAttributes,
  'id' | 'notes' | 'created_at' | 'updated_at' | 'deleted_at'
>;

/** Table `attendances` in dexa_attendance. See docs/database-design.md. */
@Table({ tableName: 'attendances' })
export class Attendance extends Model<AttendanceAttributes, AttendanceCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  employee_id: string;

  @Column({ type: DataType.ENUM(...ATTENDANCE_TYPES), allowNull: false })
  type: AttendanceType;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  attendance_date: string;

  @Column({ type: DataType.DATE(3), allowNull: false })
  recorded_at: Date;

  @Column({ type: DataType.STRING(255), allowNull: false })
  photo_path: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  photo_mime: string;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  photo_size: number;

  @Column({ type: DataType.STRING(255), allowNull: true })
  notes: string | null;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;

  @DeletedAt
  deleted_at: Date | null;
}
