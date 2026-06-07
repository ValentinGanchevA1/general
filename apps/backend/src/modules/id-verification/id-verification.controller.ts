import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { IdVerificationService } from './id-verification.service';
import { SubmitIdVerificationDto } from './dto/submit-id-verification.dto';

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
}
