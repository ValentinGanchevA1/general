import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AcceptTermsResponse, TermsStatusResponse } from '@g88/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AllowAgePending } from '../auth/adult-eligibility';
import { CurrentUser } from '../auth/current-user.decorator';
import { AcceptTermsDto } from './terms.dto';
import { TermsService } from './terms.service';

@Controller('terms')
@UseGuards(JwtAuthGuard)
@AllowAgePending('always')
export class TermsController {
  constructor(private readonly terms: TermsService) {}

  @Get('status')
  status(@CurrentUser('id') userId: string): Promise<TermsStatusResponse> {
    return this.terms.status(userId);
  }

  @Post('accept')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  accept(@CurrentUser('id') userId: string, @Body() dto: AcceptTermsDto): Promise<AcceptTermsResponse> {
    return this.terms.accept(userId, dto.version, dto.accepted, dto.channel);
  }
}
