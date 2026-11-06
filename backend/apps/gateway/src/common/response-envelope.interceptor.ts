import { HttpStatus, Injectable, RequestMethod, StreamableFile } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import { DEFAULT_SUCCESS_MESSAGE, RESPONSE_MESSAGE_KEY, envelope } from './api-response.js';
import type { ApiResponse } from './api-response.js';

/**
 * Wraps every successful handler result in { status, message, data }.
 * Errors are wrapped by HttpExceptionFilter in the same shape.
 * Files (a `StreamableFile`, e.g. an attendance photo) are sent as they are.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse | StreamableFile> {
    const targets = [context.getHandler(), context.getClass()];
    const message = this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, targets) ?? DEFAULT_SUCCESS_MESSAGE;
    const status = this.successStatus(context);

    return next
      .handle()
      .pipe(map((data: unknown) => (data instanceof StreamableFile ? data : envelope(status, message, data))));
  }

  /**
   * The status Nest will send: @HttpCode(...) if set, else 201 for POST and 200
   * otherwise. Read from metadata because Nest sets it on the response only
   * after interceptors have run.
   */
  private successStatus(context: ExecutionContext): number {
    const explicit = this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler());
    if (explicit !== undefined) return explicit;
    const method = context.switchToHttp().getRequest<Request>().method;
    return method === RequestMethod[RequestMethod.POST] ? HttpStatus.CREATED : HttpStatus.OK;
  }
}
