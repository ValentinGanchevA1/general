import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, mergeMap, Observable } from 'rxjs';
import { REQUIRE_CURRENT_TERMS } from './require-terms.decorator';
import { TermsService } from './terms.service';

@Injectable()
export class TermsInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly terms: TermsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_CURRENT_TERMS, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required) return next.handle();
    const userId = context.switchToHttp().getRequest<{ user?: { id?: string } }>().user?.id;
    if (!userId) throw new UnauthorizedException({
      code: 'terms.authentication_required', message: 'Sign in to publish content.',
    });
    return from(this.terms.assertAccepted(userId)).pipe(mergeMap(() => next.handle()));
  }
}
