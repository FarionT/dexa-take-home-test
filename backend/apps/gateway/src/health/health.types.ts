import type { ServiceKey } from '@app/shared';

export type ServiceStatus =
  | { status: 'up'; database: 'up' | 'down'; uptime_seconds: number }
  | { status: 'down'; error: string };

export interface HealthResponse {
  /** `degraded` when at least one service does not answer or cannot reach its database. */
  status: 'ok' | 'degraded';
  services: Record<ServiceKey, ServiceStatus>;
}
