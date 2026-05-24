import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // WS contexts have no HTTP response — let them propagate.
    if (host.getType() !== 'http') return;

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let statusCode: number;
    let code: string;
    let message: string;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        code = typeof b['code'] === 'string' ? b['code'] : `http.${statusCode}`;
        // ValidationPipe puts constraint strings in message as an array.
        message = typeof b['message'] === 'string'
          ? b['message']
          : Array.isArray(b['message'])
            ? (b['message'] as unknown[]).map(String).join('; ')
            : exception.message;
        details = typeof b['details'] === 'object' && b['details'] !== null
          ? (b['details'] as Record<string, unknown>)
          : undefined;
      } else {
        code = `http.${statusCode}`;
        message = String(body);
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'internal';
      message = 'Internal server error';
      this.logger.error(
        `Unhandled exception on ${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      Sentry.captureException(exception);
    }

    res.status(statusCode).json({
      statusCode,
      code,
      message,
      ...(details ? { details } : {}),
    });
  }
}
