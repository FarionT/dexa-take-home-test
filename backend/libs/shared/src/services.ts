export const SERVICE_KEYS = ['auth', 'employee', 'attendance'] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];

/** DI tokens for the gateway's TCP clients, one per service. */
export const SERVICE_CLIENTS: Record<ServiceKey, string> = {
  auth: 'AUTH_SERVICE',
  employee: 'EMPLOYEE_SERVICE',
  attendance: 'ATTENDANCE_SERVICE',
};

const DEFAULT_PORTS: Record<ServiceKey, number> = {
  auth: 3001,
  employee: 3002,
  attendance: 3003,
};

export interface TcpAddress {
  host: string;
  port: number;
}

/**
 * TCP address a service listens on (and the gateway connects to), read from
 * `<KEY>_SERVICE_HOST` / `<KEY>_SERVICE_PORT`, e.g. `AUTH_SERVICE_PORT`.
 *
 * Read straight from process.env because it is needed at bootstrap and at
 * module-definition time, before any DI container exists.
 */
export function getServiceAddress(key: ServiceKey): TcpAddress {
  const prefix = `${key.toUpperCase()}_SERVICE`;
  const host = process.env[`${prefix}_HOST`] ?? '127.0.0.1';
  const rawPort = process.env[`${prefix}_PORT`];
  const port = rawPort === undefined ? DEFAULT_PORTS[key] : Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${prefix}_PORT must be a port number, got "${rawPort}"`);
  }
  return { host, port };
}
