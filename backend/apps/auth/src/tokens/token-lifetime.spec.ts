import { parseDurationToSeconds } from './token-lifetime.js';

describe('parseDurationToSeconds', () => {
  it.each([
    ['3600', 3600],
    ['45s', 45],
    ['30m', 1800],
    ['12h', 43200],
    ['1d', 86400],
    [' 2d ', 172800],
  ])('parses %j as %i seconds', (value, seconds) => {
    expect(parseDurationToSeconds(value)).toBe(seconds);
  });

  it.each(['', '0', '1w', 'abc', '-5m', '1.5h'])('rejects %j', (value) => {
    expect(() => parseDurationToSeconds(value)).toThrow('JWT_EXPIRES_IN');
  });
});
