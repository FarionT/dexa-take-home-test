import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashes with bcrypt cost 12 and verifies only the right password', async () => {
    const stored = await passwords.hash('Secret123');

    expect(stored).toMatch(/^\$2b\$12\$.{53}$/);
    expect(await passwords.verify('Secret123', stored)).toBe(true);
    expect(await passwords.verify('secret123', stored)).toBe(false);
  });

  it('gives a different hash for the same password (random salt)', async () => {
    expect(await passwords.hash('Secret123')).not.toBe(await passwords.hash('Secret123'));
  });

  it('returns false without a stored hash, after running bcrypt on the dummy hash', async () => {
    const started = performance.now();
    expect(await passwords.verify('anything', undefined)).toBe(false);
    // Cost 12 takes well over 20ms; an instant "false" would leak that the email is unknown.
    expect(performance.now() - started).toBeGreaterThan(20);
  });
});
