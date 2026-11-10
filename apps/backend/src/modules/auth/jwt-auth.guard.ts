import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom, isObservable } from 'rxjs';

import { AdultEligibilityService } from './adult-eligibility.service';
import { SKIP_ADULT_ELIGIBILITY_KEY } from './age-eligibility.decorator';

interface AuthRequest {
  user?: { id?: string };
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly adultEligibility: AdultEligibilityService;

  constructor(
    @InjectDataSource() db: DataSource,
    private readonly reflector: Reflector,
  ) {
    super();
    // TypeORM DataSource is globally available; many feature modules using this
    // guard do not import AuthModule. Avoid a module-local DI dependency here.
    this.adultEligibility = new AdultEligibilityService(db);
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
