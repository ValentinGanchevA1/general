import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { IdVerificationService } from './id-verification.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';

@Controller('verification/id')
@UseGuards(JwtAuthGuard)
export class IdVerificationController {
  constructor(private readonly service: IdVerificationService) {}

  @Post('start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async start(@CurrentUser('id') userId: string) {
    return this.service.startVerification(userId);
  }

  @Post('submit')
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
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
}
