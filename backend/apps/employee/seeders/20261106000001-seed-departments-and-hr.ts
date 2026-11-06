import type { QueryInterface } from 'sequelize';

// sequelize-cli calls up/down with (queryInterface, Sequelize module).
type SequelizeModule = typeof import('sequelize');

/**
 * Seeds 3 departments and the first HR employee (who gets the ADMIN login in
 * apps/auth/seeders/20261106000001-seed-hr-admin.ts).
 *
 * Fixed IDs: the auth seeder links the login to SEED_HR_EMPLOYEE_ID without
 * reading this database (one database per service). Keep both files in sync.
 * Safe to run again: existing rows are skipped. Runs on plain Node, so values
 * are written out here instead of imported from app code.
 */
const DEPARTMENTS = [
  { id: 'd0000000-0000-4000-8000-000000000001', name: 'Human Resources' },
  { id: 'd0000000-0000-4000-8000-000000000002', name: 'Engineering' },
  { id: 'd0000000-0000-4000-8000-000000000003', name: 'Finance' },
];
const HR_DEPARTMENT_NAME = 'Human Resources';
const SEED_HR_EMPLOYEE_ID = 'e0000000-0000-4000-8000-000000000001';
const SEED_HR_POSITION = 'HR Manager';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

/** Today in Asia/Jakarta as YYYY-MM-DD (the business day used across the app). */
function todayInJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

/** Same format as formatEmployeeCode() in the employee service: at least 4 digits, never truncated. */
function formatEmployeeCode(value: number): string {
  return `EMP-${String(value).padStart(4, '0')}`;
}

export async function up(qi: QueryInterface, Sequelize: SequelizeModule): Promise<void> {
  const { QueryTypes } = Sequelize;
  const sequelize = qi.sequelize;
  const fullName = requireEnv('SEED_ADMIN_NAME');
  const email = requireEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const now = new Date();

  await sequelize.transaction(async (transaction) => {
    // 1. Departments: insert the ones not already live (matched by name).
    const existing = await sequelize.query<{ name: string }>(
      'SELECT `name` FROM `departments` WHERE `deleted_at` IS NULL',
      { type: QueryTypes.SELECT, transaction },
    );
    const missing = DEPARTMENTS.filter((d) => !existing.some((e) => e.name === d.name));
    if (missing.length > 0) {
      await qi.bulkInsert(
        'departments',
        missing.map((d) => ({ ...d, created_at: now, updated_at: now })),
        { transaction },
      );
    }

    // 2. HR employee: skip if already seeded; refuse if the email belongs to someone else,
    //    because the auth seeder would then link the admin login to the wrong employee.
    const [current] = await sequelize.query<{ id: string }>(
      'SELECT `id` FROM `employees` WHERE (`id` = ? OR `email` = ?) AND `deleted_at` IS NULL',
      { replacements: [SEED_HR_EMPLOYEE_ID, email], type: QueryTypes.SELECT, transaction },
    );
    if (current) {
      if (current.id !== SEED_HR_EMPLOYEE_ID) {
        throw new Error(`${email} already belongs to another employee. Use a different SEED_ADMIN_EMAIL.`);
      }
      return;
    }

    const [hrDepartment] = await sequelize.query<{ id: string }>(
      'SELECT `id` FROM `departments` WHERE `name` = ? AND `deleted_at` IS NULL',
      { replacements: [HR_DEPARTMENT_NAME], type: QueryTypes.SELECT, transaction },
    );
    if (!hrDepartment) throw new Error(`Department "${HR_DEPARTMENT_NAME}" is missing.`);

    // Same race-free counter as EmployeeCodeService: lock, increment, insert in one transaction.
    const [counter] = await sequelize.query<{ last_number: number }>(
      "SELECT `last_number` FROM `sequences` WHERE `name` = 'employee_code' AND `deleted_at` IS NULL FOR UPDATE",
      { type: QueryTypes.SELECT, transaction },
    );
    if (!counter) throw new Error('Sequence "employee_code" is missing. Run the employee migrations.');
    const number = counter.last_number + 1;
    await sequelize.query(
      "UPDATE `sequences` SET `last_number` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `name` = 'employee_code'",
      { replacements: [number], transaction },
    );

    await qi.bulkInsert(
      'employees',
      [
        {
          id: SEED_HR_EMPLOYEE_ID,
          employee_code: formatEmployeeCode(number),
          full_name: fullName,
          email,
          phone: null,
          position: SEED_HR_POSITION,
          department_id: hrDepartment.id,
          hire_date: todayInJakarta(),
          status: 'ACTIVE',
          created_by: null, // seeded rows have no creator
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
      ],
      { transaction },
    );
  });
}

/**
 * Undo removes the seeded rows for real (they were never business data).
 * Departments that other employees now use are refused by the FK (ON DELETE
 * RESTRICT). The employee code stays used: codes are never handed out twice.
 */
export async function down(qi: QueryInterface): Promise<void> {
  await qi.bulkDelete('employees', { id: SEED_HR_EMPLOYEE_ID });
  await qi.bulkDelete('departments', { id: DEPARTMENTS.map((d) => d.id) });
}
