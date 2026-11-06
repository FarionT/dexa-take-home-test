import { RpcException } from '@nestjs/microservices';

/**
 * Error body a service sends back to the gateway. The gateway turns it into an
 * HTTP error with the same status code. Anything else a service throws reaches
 * the gateway as an unknown error and becomes a 500.
 */
export interface RpcErrorPayload {
  status_code: number;
  message: string;
}

/** Throw from a service handler: `throw rpcError(401, 'Invalid email or password')`. */
export function rpcError(statusCode: number, message: string): RpcException {
  const payload: RpcErrorPayload = { status_code: statusCode, message };
  return new RpcException(payload);
}

export function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status_code' in value &&
    typeof value.status_code === 'number' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}
