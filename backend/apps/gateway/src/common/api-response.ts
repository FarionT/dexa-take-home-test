import { SetMetadata } from '@nestjs/common';

/**
 * The body of every gateway response, success or error:
 *   { status: 200, message: 'Login successful', data: { ... } }
 *   { status: 401, message: 'Invalid email or password' }
 *   { status: 400, message: 'Validation failed', data: { errors: ['...'] } }
 * `status` repeats the HTTP status code. `data` is left out when there is nothing to return.
 */
export interface ApiResponse<T = unknown> {
  status: number;
  message: string;
  data?: T;
}

/** `data` of a 400 caused by request validation: one entry per problem. */
export interface ValidationErrorData {
  errors: string[];
}

export const RESPONSE_MESSAGE_KEY = 'api:response-message';
export const DEFAULT_SUCCESS_MESSAGE = 'Success';

/** The `message` of this endpoint's success response, e.g. @ResponseMessage('Login successful'). */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);

export function envelope<T>(status: number, message: string, data?: T): ApiResponse<T> {
  return data === undefined || data === null ? { status, message } : { status, message, data };
}
