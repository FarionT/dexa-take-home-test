import type { ServiceKey } from './services.js';

/** Reply of every service's PING message. */
export interface ServicePing {
  service: ServiceKey;
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export function createPing(service: ServiceKey): ServicePing {
  return {
    service,
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
