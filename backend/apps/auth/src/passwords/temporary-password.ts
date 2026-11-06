import { randomInt } from 'node:crypto';

// No look-alike characters (0/O, 1/l/I), so HR can read the password out without mistakes.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;
const LENGTH = 14;

function pick(chars: string): string {
  return chars.charAt(randomInt(chars.length));
}

/**
 * A random password for a new or reactivated account, e.g. "q7KmT3xPa9WdRf".
 * Uses crypto.randomInt (a cryptographically secure source) and always contains
 * an upper-case letter, a lower-case letter and a digit, so it meets the
 * password rules. The user must change it at first login.
 */
export function generateTemporaryPassword(): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < LENGTH) chars.push(pick(ALL));
  // Fisher-Yates shuffle, so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
