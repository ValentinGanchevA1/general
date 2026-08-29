import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InteractionsService } from './interactions.service';

@Controller('interactions')
@UseGuards(JwtAuthGuard)
export class InteractionsController {
  constructor(private readonly service: InteractionsService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '30',
  ) {
    return this.service.getInteractions(req.user.id, {
      cursor,
      limit: Math.min(parseInt(limit, 10) || 30, 50),
    });
  }
}
