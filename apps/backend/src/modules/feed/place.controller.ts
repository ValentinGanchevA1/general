import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type { NexaPlaceDetail, NexaPlaceSaveState } from '@g88/shared';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaceCatalogService } from './place-catalog.service';
import { PlaceSaveService } from './place-save.service';

@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlaceController {
  constructor(
    private readonly places: PlaceCatalogService,
    private readonly saves: PlaceSaveService,
  ) {}

  @Get(':placeId')
  async detail(
    @CurrentUser('id') userId: string,
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string,
  ): Promise<NexaPlaceDetail> {
    const place = await this.places.getPublicDetail(placeId);
    if (!place) throw new NotFoundException('Place not found.');
    const saved = await this.saves.isSavedCanonicalPlace(userId, place.id);
    return { ...place, saved };
  }

  @Post(':placeId/save')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async save(
    @CurrentUser('id') userId: string,
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string,
  ): Promise<NexaPlaceSaveState> {
    const state = await this.saves.save(userId, placeId);
    if (!state) throw new NotFoundException('Place not found.');
    return state;
  }

  @Delete(':placeId/save')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async unsave(
    @CurrentUser('id') userId: string,
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string,
  ): Promise<NexaPlaceSaveState> {
    const state = await this.saves.unsave(userId, placeId);
    if (!state) throw new NotFoundException('Place not found.');
    return state;
  }
}
