import { normalizeEmail } from '@app/shared';

// class-transformer helpers for request DTOs. Non-strings pass through
// unchanged, so the validators report the wrong type.

export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Empty or blank text becomes null (e.g. clearing an optional phone number). */
export function trimToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function toNormalizedEmail({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? normalizeEmail(value) : value;
}
