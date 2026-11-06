import type { EmployeeAccount, EmployeeRecord } from '@app/shared';

/**
 * An employee as the API returns it: HR data from the employee service plus
 * the login (`account`) from the auth service. `account` is null if the
 * employee has no login (should not happen; shown so HR can spot it).
 */
export interface EmployeeView extends EmployeeRecord {
  account: EmployeeAccount | null;
}

export interface EmployeeListView {
  items: EmployeeView[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/** Create: the temporary password is shown to HR once and never stored in plain text. */
export interface CreatedEmployeeView {
  employee: EmployeeView;
  temporary_password: string;
}

/** Update: a temporary password only when the employee was reactivated. */
export interface UpdatedEmployeeView {
  employee: EmployeeView;
  temporary_password: string | null;
}
