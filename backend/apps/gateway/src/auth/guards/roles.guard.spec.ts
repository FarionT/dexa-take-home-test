import { hasRole } from './roles.guard.js';

describe('hasRole', () => {
  it.each([
    ['EMPLOYEE', ['EMPLOYEE'], true],
    ['EMPLOYEE', ['ADMIN'], false],
    ['ADMIN', ['ADMIN'], true],
    ['ADMIN', ['EMPLOYEE'], true], // ADMIN includes EMPLOYEE
    ['EMPLOYEE', ['ADMIN', 'EMPLOYEE'], true],
  ] as const)('%s with required %j -> %s', (role, required, expected) => {
    expect(hasRole(role, required)).toBe(expected);
  });
});
