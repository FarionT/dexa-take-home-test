const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Parses JWT_EXPIRES_IN ("3600", "30m", "12h", "1d") into seconds. The token
 * gets this lifetime and the login response reports it as `expires_in`.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  const seconds = match ? Number(match[1]) * (UNIT_SECONDS[match[2] || 's'] ?? 1) : NaN;
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error(`JWT_EXPIRES_IN must look like 3600, 30m, 12h or 1d; got "${value}"`);
  }
  return seconds;
}
