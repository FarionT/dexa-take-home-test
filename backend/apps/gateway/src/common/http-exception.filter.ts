import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { envelope } from './api-response.js';
import type { ApiResponse, ValidationErrorData } from './api-response.js';

const VALIDATION_FAILED = 'Validation failed';
const UNEXPECTED_ERROR = 'Something went wrong. Please try again.';

/**
 * Turns every error into the same envelope as successful responses:
 *   { status: 401, message: 'Invalid email or password' }
 *   { status: 400, message: 'Validation failed', data: { errors: [...] } }
 * Unknown errors become a generic 500; their details are logged, never sent.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toEnvelope(exception);
    response.status(body.status).json(body);
  }

  private toEnvelope(exception: unknown): ApiResponse<ValidationErrorData> {
    if (!(exception instanceof HttpException)) {
      this.logger.error('Unhandled error', exception instanceof Error ? exception.stack : String(exception));
      return envelope(HttpStatus.INTERNAL_SERVER_ERROR, UNEXPECTED_ERROR);
    }

    const status = exception.getStatus();
    const original = exception.getResponse();
    // Nest's built-in exceptions put { message } in the response; ValidationPipe uses a list of messages.
    const message: unknown =
      typeof original === 'object' && original !== null && 'message' in original ? original.message : original;

    if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
      return envelope(status, VALIDATION_FAILED, { errors: message });
    }
    return envelope(status, typeof message === 'string' ? message : exception.message);
  }
}
