import {
  Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from '../id-verification/admin.guard';
import {
  PersonalLabelsLocaleDto, PersonalLabelQueueDto, ProposePersonalLabelDto,
  ReviewPersonalLabelDto, SetPersonalLabelsDto,
} from './personal-labels.dto';
import { PersonalLabelsService } from './personal-labels.service';
import type { PersonalLabelReviewRequest } from '@g88/shared';

@Controller('personal-labels')
@UseGuards(JwtAuthGuard)
@Header('Cache-Control', 'private, no-store')
export class PersonalLabelsController {
  constructor(private readonly labels: PersonalLabelsService) {}

  @Get('catalog')
  catalog(@Query() query: PersonalLabelsLocaleDto) {
    return this.labels.catalog(query.locale);
  }
  @Get('me')
  mine(@CurrentUser('id') id: string, @Query() query: PersonalLabelsLocaleDto) {
    return this.labels.myLabels(id, query.locale);
  }
  @Put('me')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  update(@CurrentUser('id') id: string, @Body() dto: SetPersonalLabelsDto, @Query() query: PersonalLabelsLocaleDto) {
    return this.labels.setMine(id, dto, query.locale);
  }
  @Post('proposals')
  @Throttle({ default: { limit: 2, ttl: 3_600_000 } })
  propose(@CurrentUser('id') id: string, @Body() dto: ProposePersonalLabelDto) {
    return this.labels.submit(id, dto);
  }
  @Get('proposals/me')
  suggestions(@CurrentUser('id') id: string) {
    return this.labels.myProposals(id);
  }
}

@Controller('admin/personal-label-proposals')
@UseGuards(JwtAuthGuard, AdminGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Header('Cache-Control', 'private, no-store')
export class AdminPersonalLabelsController {
  constructor(private readonly labels: PersonalLabelsService) {}
  @Get()
  queue(@Query() query: PersonalLabelQueueDto) {
    return this.labels.queue(query);
  }
  @Post(':id/decide')
  decide(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPersonalLabelDto,
  ) {
    return this.labels.review(adminId, id, dto as PersonalLabelReviewRequest);
  }
}
