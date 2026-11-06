import {
  HttpException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { TimeoutError, firstValueFrom, timeout } from 'rxjs';
import { isRpcErrorPayload } from '@app/shared';

const RPC_TIMEOUT_MS = 5000;
const CONNECTION_ERROR_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT']);
const logger = new Logger('ServiceRpc');

function isConnectionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    CONNECTION_ERROR_CODES.has(error.code)
  );
}

/**
 * Sends a message to a microservice and turns its errors into HTTP errors:
 * - an `rpcError(status, message)` from the service -> that HTTP status and message
 * - service down or too slow -> 503
 * - anything else -> 500 (details logged, not sent to the client)
 */
export async function sendToService<TResult, TPayload>(
  client: ClientProxy,
  pattern: string,
  payload: TPayload,
): Promise<TResult> {
  try {
    return await firstValueFrom(
      client.send<TResult, TPayload>(pattern, payload).pipe(timeout(RPC_TIMEOUT_MS)),
    );
  } catch (error: unknown) {
    if (isRpcErrorPayload(error)) {
      throw new HttpException(error.message, error.status_code);
    }
    if (error instanceof TimeoutError || isConnectionError(error)) {
      logger.error(`${pattern}: service unavailable (${error instanceof Error ? error.message : 'timeout'})`);
      throw new ServiceUnavailableException('Service is temporarily unavailable. Please try again.');
    }
    logger.error(`${pattern}: unexpected error`, error instanceof Error ? error.stack : JSON.stringify(error));
    throw new InternalServerErrorException();
  }
}
