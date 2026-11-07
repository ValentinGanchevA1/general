import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from '../id-verification/admin.guard';
import { ContentReportsService } from './content-reports.service';
import { ContentReportQueueDto, CreateContentReportDto, DecideContentReportDto } from './dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ContentReportsController {
  constructor(private readonly service: ContentReportsService) {}
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  submit(@CurrentUser('id') id: string, @Body() dto: CreateContentReportDto) {
    return this.service.submit(id, dto);
  }
}

@Controller('admin/content-reports')
@UseGuards(JwtAuthGuard, AdminGuard)
@Throttle({ default: { ttl: 60_000, limit: 30 } })
export class AdminContentReportsController {
  constructor(private readonly service: ContentReportsService) {}
  @Get()
  list(@Query() dto: ContentReportQueueDto) { return this.service.list(dto); }
  @Post(':id/decide')
  decide(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideContentReportDto,
  ) {
    return this.service.decide(adminId, id, dto);
  }
}
