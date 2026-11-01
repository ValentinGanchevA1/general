import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

import { RuntimeHttpDiagnosticsService } from './runtime-http-diagnostics.service';

interface HttpResponseLifecycle {
  statusCode: number;
  once(event: 'finish' | 'close', listener: () => void): this;
  removeListener(event: 'finish' | 'close', listener: () => void): this;
}

@Injectable()
export class RuntimeHttpDiagnosticsInterceptor implements NestInterceptor {
  constructor(private readonly diagnostics: RuntimeHttpDiagnosticsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<HttpResponseLifecycle>();
    const request = this.diagnostics.beginRequest();
    let settled = false;

    const cleanup = (): void => {
      response.removeListener('finish', onFinish);
      response.removeListener('close', onClose);
    };
    const onFinish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      request.finish(response.statusCode);
    };
    const onClose = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      request.abort();
    };

    response.once('finish', onFinish);
    response.once('close', onClose);

    return next.handle();
  }
}
