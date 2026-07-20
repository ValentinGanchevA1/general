import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { IdVerificationService } from './id-verification.service';
import { ListPendingVerificationsDto } from './dto/list-pending-verifications.dto';
import { ListPendingResponseDto } from './dto/list-pending-response.dto';
import { AdminVerificationDetailDto } from './dto/admin-verification-detail.dto';
import { DecideIdVerificationDto } from './dto/decide-id-verification.dto';

/**
 * Admin-only ID verification review queue.
 * All routes require an authenticated admin (JwtAuthGuard + AdminGuard),
 * checked once at the class level rather than per-route.
 *
 * This is the HTTP surface for the review workflow that
 * `apps/backend/scripts/review-id-verifications.mjs` currently does by
 * hitting Postgres + S3 directly — that script remains useful as a
 * DB-level escape hatch, this controller is the path for a real admin UI.
 */
@Controller('admin/verifications')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminIdVerificationController {
  constructor(private readonly service: IdVerificationService) {}

  @Get('pending')
  async listPending(@Query() dto: ListPendingVerificationsDto): Promise<ListPendingResponseDto> {
    return this.service.listPendingVerifications(dto);
  }

  @Get('pending/:userId')
  async getPendingDetail(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<AdminVerificationDetailDto> {
    return this.service.getVerificationDetail(userId);
  }

  @Post('pending/:userId/decide')
  async decide(
    @CurrentUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: DecideIdVerificationDto,
  ) {
    return this.service.decideVerification(adminId, userId, dto);
  }
}
