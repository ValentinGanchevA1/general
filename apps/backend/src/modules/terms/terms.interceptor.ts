import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, mergeMap, Observable } from 'rxjs';
import { REQUIRE_CURRENT_TERMS } from './require-terms.decorator';
import { ALLOW_TERMS_PRIVACY_REDUCTION, isPrivacyReductionOnly } from './privacy-reduction';
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
    const request = context.switchToHttp().getRequest<{
      user?: { id?: string };
      body?: unknown;
    }>();
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException({
      code: 'terms.authentication_required', message: 'Sign in to publish content.',
    });
    const privacyReduction = this.reflector.getAllAndOverride<boolean>(
      ALLOW_TERMS_PRIVACY_REDUCTION,
      [context.getHandler(), context.getClass()],
    );
    if (privacyReduction && isPrivacyReductionOnly(request.body)) {
      // Reducing account visibility must remain possible even during a Terms
      // reacceptance lockout. No public UGC creation is allowed via this path.
      return next.handle();
    }
    return from(this.terms.assertAccepted(userId)).pipe(mergeMap(() => next.handle()));
  }
}
