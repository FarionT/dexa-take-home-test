import { generateTemporaryPassword } from './temporary-password.js';

describe('generateTemporaryPassword', () => {
  const samples = Array.from({ length: 200 }, () => generateTemporaryPassword());

  it('is 14 characters from an alphabet without look-alikes (0 O 1 l I)', () => {
    for (const password of samples) {
      expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{14}$/);
    }
  });

  it('always meets the password rules: upper, lower and a digit', () => {
    for (const password of samples) {
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/\d/);
    }
  });

  it('is random', () => {
    expect(new Set(samples).size).toBe(samples.length);
  });
});
