import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { AuthGuard } from '@nestjs/passport';
import { isObservable, lastValueFrom } from 'rxjs';
import type { DataSource } from 'typeorm';
import { isAdultDeclarationOnly, isPrivacyReductionOnly } from '../terms/privacy-reduction';
import {
  AGE_PENDING_PERMISSION,
  assertAdultAge,
  isAdultGateEnforced,
  type AgePendingPermission,
} from './adult-eligibility';
import type { ExecutionContext } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly db: DataSource,
  ) { super(); }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authResult = super.canActivate(context);
    const authenticated = isObservable(authResult)
      ? await lastValueFrom(authResult)
      : await authResult;
    if (!authenticated || !isAdultGateEnforced()) return Boolean(authenticated);

    // Passport has already validated the signed JWT and set request.user.
    const request = context.switchToHttp().getRequest<{
      user?: { id?: string };
      body?: unknown;
    }>();
    const permission = this.reflector.getAllAndOverride<AgePendingPermission>(
      AGE_PENDING_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (permission === 'always') return true;
    if (permission === 'profile_update') {
      // An age-pending account may declare its DOB or reduce public exposure,
      // but must not bundle either exception with unrelated UGC mutations.
      if (isPrivacyReductionOnly(request.body) || isAdultDeclarationOnly(request.body)) {
        return true;
      }
    }
    await assertAdultAge(this.db, request.user?.id ?? '');
    return true;
  }
}
