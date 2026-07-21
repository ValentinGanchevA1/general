import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { IdVerificationService } from './id-verification.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';
import { DecideIdVerificationDto } from './dto/decide-id-verification.dto';
import { ListPendingVerificationsDto } from './dto/list-pending-verifications.dto';
import { AdminGuard } from './admin.guard';

@Controller('verification/id')
@UseGuards(JwtAuthGuard)
export class IdVerificationController {
  constructor(private readonly service: IdVerificationService) {}

  @Post('start')
  async start(@CurrentUser('id') userId: string) {
    return this.service.startVerification(userId);
  }

  @Post('submit')
  async submit(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitIdVerificationDto,
  ) {
    return this.service.submitVerification(userId, dto);
  }

  @Get('status')
  async status(@CurrentUser('id') userId: string) {
    return this.service.getStatus(userId);
  }

  @Get('admin/pending')
  @UseGuards(AdminGuard)
  async listPending(@Query() query: ListPendingVerificationsDto) {
    return this.service.listPending(query);
  }

  @Get('admin/:userId')
  @UseGuards(AdminGuard)
  async adminDetail(@Param('userId') userId: string) {
    return this.service.getAdminDetail(userId);
  }

  @Post('admin/:userId/decide')
  @UseGuards(AdminGuard)
  async decide(
    @CurrentUser('id') adminId: string,
    @Param('userId') userId: string,
    @Body() dto: DecideIdVerificationDto,
  ) {
    return this.service.decideVerification(adminId, userId, dto);
  }
}
