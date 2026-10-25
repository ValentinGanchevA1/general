import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
 */
@Controller('admin/verifications')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminIdVerificationController {
  constructor(private readonly service: IdVerificationService) {}

  /** Safe ops probe: booleans/counts only, never credentials or admin IDs. */
  @Get('readiness')
  readiness() {
    return this.service.getOperationalReadiness();
  }

  @Get('pending')
  async listPending(
    @Query() dto: ListPendingVerificationsDto,
  ): Promise<ListPendingResponseDto> {
    return this.service.listPendingVerifications(dto);
  }

  @Get('pending/:userId')
  async getPendingDetail(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<AdminVerificationDetailDto> {
    return this.service.getVerificationDetail(userId);
  }

  @Post('pending/:userId/decide')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async decide(
    @CurrentUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: DecideIdVerificationDto,
  ) {
    return this.service.decideVerificationIdempotent(adminId, userId, dto);
  }
}
