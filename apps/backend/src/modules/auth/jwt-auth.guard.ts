import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom, isObservable } from 'rxjs';

import { AdultEligibilityService } from './adult-eligibility.service';
import { SKIP_ADULT_ELIGIBILITY_KEY } from './age-eligibility.decorator';

interface AuthRequest {
  user?: { id?: string };
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly adultEligibility: AdultEligibilityService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    const passed = isObservable(authenticated)
      ? await firstValueFrom(authenticated)
      : authenticated;
    if (!passed) return false;

    const bootstrapRoute = this.reflector.getAllAndOverride<boolean>(
      SKIP_ADULT_ELIGIBILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!bootstrapRoute) {
      const request = context.switchToHttp().getRequest<AuthRequest>();
      await this.adultEligibility.assertEligible(request.user?.id);
    }
    return true;
  }
}
