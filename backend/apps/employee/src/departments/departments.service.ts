import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { DepartmentRecord } from '@app/shared';
import { Department } from './department.model.js';

@Injectable()
export class DepartmentsService {
  constructor(@InjectModel(Department) private readonly departments: typeof Department) {}

  /** Live departments, alphabetical: the choices for the employee form. */
  async list(): Promise<DepartmentRecord[]> {
    const rows = await this.departments.findAll({ order: [['name', 'ASC']] });
    return rows.map((department) => ({ id: department.id, name: department.name }));
  }
}
