import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  computeH3Cells,
  LISTING_LIMITS,
  type ListingStatus,
  type MarketplaceKind,
  type MarketplaceListingSummary,
} from '@g88/shared';

import { NotificationsService } from '../notifications/notifications.service';
import { BrowseMarketplaceDto, CreateMarketplaceListingDto } from './marketplace.dto';

interface MarketplaceRow {
  id: string;
  seller_id: string;
  title: string;
  thumbnail_url: string | null;
  price_cents: number;
  currency: string;
  category: string;
  status: ListingStatus;
  mode: 'sell';
  marketplace_kind: MarketplaceKind;
  lat: number;
  lng: number;
  created_at: Date;
  expires_at: Date | null;
  bumped_at: Date | null;
  favorited_by_me: boolean;
}

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    sellerId: string,
    dto: CreateMarketplaceListingDto,
  ): Promise<MarketplaceListingSummary> {
    const cells = computeH3Cells(dto.location.lat, dto.location.lng);
    const expiresAt = new Date(Date.now() + LISTING_LIMITS.ttlDaysSell * 86_400_000);
    const rows = (await this.db.query(
      `INSERT INTO listings
         (seller_id, title, description, thumbnail_url, price_cents, currency, category,
          visibility, mode, marketplace_kind, expires_at,
          location, location_h3_r4, location_h3_r5, location_h3_r6,
          location_h3_r7, location_h3_r8, location_h3_r9, location_h3_r10)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, 'sell', $9, $10,
          ST_SetSRID(ST_MakePoint($11, $12), 4326)::geography,
          $13, $14, $15, $16, $17, $18, $19)
       RETURNING id, seller_id, title, thumbnail_url, price_cents, currency, category,
                 status, mode, marketplace_kind, created_at, expires_at, bumped_at,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`,
      [
        sellerId,
        dto.title,
        dto.description ?? null,
        dto.thumbnailUrl ?? null,
        dto.priceCents,
        dto.currency ?? 'USD',
        dto.category,
        dto.visibility ?? 'public',
        dto.marketplaceKind,
        expiresAt,
        dto.location.lng,
        dto.location.lat,
        cells.r4,
        cells.r5,
        cells.r6,
        cells.r7,
        cells.r8,
        cells.r9,
        cells.r10,
      ],
    )) as MarketplaceRow[];

    const summary = this.toSummary({ ...rows[0]!, favorited_by_me: false });
    if ((dto.visibility ?? 'public') === 'public') {
      void this.notifications
        .notifyListingNearby(cells.r7, sellerId, summary.title, summary.id)
        .catch(() => undefined);
    }
    return summary;
  }

  async browse(userId: string, dto: BrowseMarketplaceDto): Promise<MarketplaceListingSummary[]> {
    const radiusM = dto.radiusM ?? 5_000;
    const limit = dto.limit ?? 50;
    const query = dto.query?.trim() || null;
    const rows = (await this.db.query(
      `SELECT l.id, l.seller_id, l.title, l.thumbnail_url, l.price_cents, l.currency,
              l.category, l.status, l.mode, l.marketplace_kind, l.created_at,
              l.expires_at, l.bumped_at,
              ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
              (f.user_id IS NOT NULL) AS favorited_by_me
         FROM listings l
         LEFT JOIN trade_favorites f ON f.listing_id = l.id AND f.user_id = $1
        WHERE l.deleted_at IS NULL
          AND l.status = 'active'
          AND l.mode = 'sell'
          AND l.marketplace_kind = $5
          AND (l.expires_at IS NULL OR l.expires_at > NOW())
          AND (l.visibility = 'public' OR l.seller_id = $1)
          AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $1 AND ub.blocked_id = l.seller_id)
                    OR (ub.blocker_id = l.seller_id AND ub.blocked_id = $1)
              )
          AND ($7::text IS NULL
               OR l.title ILIKE '%' || $7 || '%'
               OR l.category ILIKE '%' || $7 || '%')
          AND ST_DWithin(
                l.location,
                ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                $4)
        ORDER BY l.created_at DESC
        LIMIT $6`,
      [
        userId,
        dto.location.lng,
        dto.location.lat,
        radiusM,
        dto.marketplaceKind,
        limit,
        query,
      ],
    )) as MarketplaceRow[];

    return rows.map((row) => this.toSummary(row));
  }

  private toSummary(row: MarketplaceRow): MarketplaceListingSummary {
    return {
      id: row.id,
      sellerId: row.seller_id,
      title: row.title,
      thumbnailUrl: row.thumbnail_url,
      priceCents: row.price_cents,
      currency: row.currency,
      category: row.category,
      status: row.status,
      mode: row.mode,
      marketplaceKind: row.marketplace_kind,
      location: { lat: Number(row.lat), lng: Number(row.lng) },
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at?.toISOString() ?? null,
      bumpedAt: row.bumped_at?.toISOString() ?? null,
      favoritedByMe: row.favorited_by_me,
    };
  }
}
