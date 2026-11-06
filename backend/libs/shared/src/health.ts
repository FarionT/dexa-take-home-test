import type { ServiceKey } from './services.js';

/** Reply of every service's PING message. */
export interface ServicePing {
  service: ServiceKey;
  status: 'ok';
  database: 'up' | 'down';
  uptime_seconds: number;
  timestamp: string;
}

export function createPing(service: ServiceKey, database: 'up' | 'down'): ServicePing {
  return {
    service,
    status: 'ok',
    database,
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
