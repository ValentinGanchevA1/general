import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type {
  ListingDetail,
  ListingOffer,
  ListingSummary,
  ToggleFavoriteResponse,
  UploadListingImageResponse,
} from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ListingsService } from './listings.service';
import {
  BrowseListingsDto,
  CreateListingDto,
  MakeOfferDto,
  RespondOfferDto,
  UpdateListingStatusDto,
  UploadListingImageDto,
} from './dto';

@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  /** POST /api/v1/listings — create a listing the caller sells. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateListingDto,
  ): Promise<ListingSummary> {
    return this.listings.create(userId, dto);
  }

  /**
   * POST /api/v1/listings/photo/base64 — upload a listing image, get back its
   * public URL to pass as `thumbnailUrl` on create. Base64 JSON body (RN-safe).
   * Declared before the `:id` routes so the literal path always wins.
   */
  @Post('photo/base64')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  uploadPhoto(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadListingImageDto,
  ): Promise<UploadListingImageResponse> {
    return this.listings.uploadImage(userId, dto.data, dto.contentType);
  }

  /** POST /api/v1/listings/browse — nearby browse grid (optional category). */
  @Post('browse')
  @HttpCode(HttpStatus.OK)
  browse(
    @CurrentUser('id') userId: string,
    @Body() dto: BrowseListingsDto,
  ): Promise<ListingSummary[]> {
    return this.listings.browse(userId, dto);
  }

  /** GET /api/v1/listings/favorites — the caller's saved listings. */
  @Get('favorites')
  favorites(@CurrentUser('id') userId: string): Promise<ListingSummary[]> {
    return this.listings.listFavorites(userId);
  }

  /** GET /api/v1/listings/:id — full listing detail. */
  @Get(':id')
  detail(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ListingDetail> {
    return this.listings.detail(userId, id);
  }

  /** PUT /api/v1/listings/:id/status — seller marks active/sold/withdrawn. */
  @Put(':id/status')
  updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingStatusDto,
  ): Promise<ListingDetail> {
    return this.listings.updateStatus(userId, id, dto.status);
  }

  /** PUT /api/v1/listings/:id/favorite — toggle save-for-later. */
  @Put(':id/favorite')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  toggleFavorite(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ToggleFavoriteResponse> {
    return this.listings.toggleFavorite(userId, id);
  }

  // ─── Offers ───────────────────────────────────────────────────────────────

  /** POST /api/v1/listings/:id/offers — make (or re-open) an offer. */
  @Post(':id/offers')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  makeOffer(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MakeOfferDto,
  ): Promise<ListingOffer> {
    return this.listings.makeOffer(userId, id, dto);
  }

  /** GET /api/v1/listings/:id/offers — seller sees all; a buyer sees their own. */
  @Get(':id/offers')
  listOffers(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ListingOffer[]> {
    return this.listings.listOffers(userId, id);
  }

  /** PUT /api/v1/listings/:id/offer/withdraw — buyer withdraws their offer. */
  @Put(':id/offer/withdraw')
  withdrawOffer(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ListingOffer> {
    return this.listings.withdrawOffer(userId, id);
  }

  /** PUT /api/v1/listings/offers/:offerId — seller accepts/declines an offer. */
  @Put('offers/:offerId')
  respondToOffer(
    @CurrentUser('id') userId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: RespondOfferDto,
  ): Promise<ListingOffer> {
    return this.listings.respondToOffer(userId, offerId, dto.status);
  }
}
