import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import type { NexaPlaceDetail } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaceCatalogService } from './place-catalog.service';

@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlaceController {
  constructor(private readonly places: PlaceCatalogService) {}

  @Get(':placeId')
  async detail(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string,
  ): Promise<NexaPlaceDetail> {
    const place = await this.places.getPublicDetail(placeId);
    if (!place) throw new NotFoundException('Place not found.');
    return place;
  }
}
