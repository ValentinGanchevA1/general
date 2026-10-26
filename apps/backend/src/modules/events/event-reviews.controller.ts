import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from '../id-verification/admin.guard';
import { EventReviewsService } from './event-reviews.service';
import { ReportEventReviewDto, ReviewPageDto, SaveEventReviewDto } from './review.dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { ttl: 60_000, limit: 30 } })
export class EventReviewsController {
  constructor(private readonly service: EventReviewsService) {}
  @Get(':id/reviews/me')
  me(@CurrentUser('id') actor: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.me(actor, id); }
  @Post(':id/reviews')
  create(@CurrentUser('id') actor: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveEventReviewDto) { return this.service.save(actor, id, dto, false); }
  @Patch(':id/reviews/me')
  edit(@CurrentUser('id') actor: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveEventReviewDto) { return this.service.save(actor, id, dto, true); }
  @Get(':id/reviews')
  list(@CurrentUser('id') actor: string, @Param('id', ParseUUIDPipe) id: string, @Query() dto: ReviewPageDto) { return this.service.list(actor, id, dto); }
  @Post(':id/reviews/:reviewId/report')
  report(@CurrentUser('id') actor: string, @Param('id', ParseUUIDPipe) id: string, @Param('reviewId', ParseUUIDPipe) reviewId: string, @Body() dto: ReportEventReviewDto) { return this.service.report(actor, id, reviewId, dto); }
  @Get(':id/attendance')
  attendance(@CurrentUser('id') actor: string, @Param('id', ParseUUIDPipe) id: string, @Query() dto: ReviewPageDto) { return this.service.attendance(actor, id, dto); }
  @Post(':id/attendance/:userId/confirm')
  confirm(@CurrentUser('id') actor: string, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) { return this.service.confirm(actor, id, userId); }
  @Post(':id/end')
  end(@CurrentUser('id') actor: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.end(actor, id); }
}

@Controller('admin/event-reviews')
@UseGuards(JwtAuthGuard, AdminGuard)
@Throttle({ default: { ttl: 60_000, limit: 30 } })
export class AdminEventReviewsController {
  constructor(private readonly service: EventReviewsService) {}
  @Get('reports')
  reports(@Query() dto: ReviewPageDto) { return this.service.reports(dto); }
  @Post(':eventId/:reviewId/hide')
  hide(@Param('eventId', ParseUUIDPipe) eventId: string, @Param('reviewId', ParseUUIDPipe) reviewId: string) { return this.service.hide(eventId, reviewId); }
}
