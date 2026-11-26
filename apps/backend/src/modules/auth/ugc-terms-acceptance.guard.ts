import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  configuredUgcTerms,
  UgcTermsAcceptanceService,
  ugcTermsAcceptanceEnabled,
} from './ugc-terms-acceptance.service';

interface AuthenticatedRequest {
  user?: { id?: string };
}

@Injectable()
export class UgcTermsAcceptanceGuard implements CanActivate {
  private readonly acceptance: UgcTermsAcceptanceService;

  constructor(@InjectDataSource() db: DataSource) {
    this.acceptance = new UgcTermsAcceptanceService(db);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!ugcTermsAcceptanceEnabled()) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException({
        code: 'legal.terms_acceptance_required',
        message: 'Accept the current NEXUS Terms before creating or uploading user content.',
      });
    }

    const status = await this.acceptance.status(userId);
    if (status.accepted) return true;

    const current = configuredUgcTerms();
    throw new ForbiddenException({
      code: 'legal.terms_acceptance_required',
      message: 'Accept the current NEXUS Terms before creating or uploading user content.',
      details: { termsVersion: current.version, termsSha256: current.sha256 },
    });
  }
}
