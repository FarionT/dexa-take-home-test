import type { ServiceKey } from '@app/shared';

export type ServiceStatus =
  | { status: 'up'; uptimeSeconds: number }
  | { status: 'down'; error: string };

export interface HealthResponse {
  /** `degraded` when at least one service does not answer. */
  status: 'ok' | 'degraded';
  services: Record<ServiceKey, ServiceStatus>;
}
