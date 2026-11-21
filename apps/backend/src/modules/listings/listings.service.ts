import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type QueryRunner } from 'typeorm';

import {
  computeH3Cells,
  type ListingDetail,
  type ListingOffer,
  type ListingStatus,
  type ListingSummary,
  type MarketplaceKind,
  type OfferStatus,
  type ToggleFavoriteResponse,
  type UploadListingImageResponse,
  LISTING_LIMITS,
} from '@g88/shared';

import {
  BrowseListingsDto,
  CounterOfferDto,
  CreateListingDto,
  MakeOfferDto,
} from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { S3Service } from '../../common/s3.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const OFFER_PREVIEW = 50;

interface ListingRow {
  id: string;
  seller_id: string;
  title: string;
  thumbnail_url: string | null;
  price_cents: number;
  currency: string;
  category: string;
  status: ListingStatus;
  mode: 'sell' | 'buy';
  marketplace_kind?: MarketplaceKind;
  lat: number;
  lng: number;
  created_at: Date;
  expires_at: Date | null;
  bumped_at: Date | null;
  favorited_by_me: boolean;
}


interface LockedOfferRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  status: OfferStatus;
  last_actor: 'buyer' | 'seller' | null;
  seller_id: string;
  listing_status: ListingStatus;
}

interface OfferRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  buyer_display_name: string;
  buyer_avatar_url: string | null;
  offer_cents: number | null;
  message: string | null;
  status: OfferStatus;
  last_actor: 'buyer' | 'seller' | null;
  created_at: Date;
}

@Injectable()
export class ListingsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notifications: NotificationsService,
    private readonly s3: S3Service,
  ) {}

  private async withMarketplaceTransaction<T>(
    operation: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.db.createQueryRunner();
    let connected = false;
    let transactionStarted = false;
    try {
      await queryRunner.connect();
      connected = true;
      await queryRunner.startTransaction();
      transactionStarted = true;
      const result = await operation(queryRunner);
      await queryRunner.commitTransaction();
      transactionStarted = false;
      return result;
    } catch (error: unknown) {
      if (transactionStarted) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      if (connected) await queryRunner.release();
    }
  }

  private async lockOfferForUpdate(
    queryRunner: QueryRunner,
    offerId: string,
  ): Promise<LockedOfferRow> {
    const [offerRef] = (await queryRunner.query(
      `SELECT listing_id FROM trade_offers WHERE id = $1`,
      [offerId],
    )) as Array<{ listing_id: string }>;
    if (!offerRef) {
      throw new NotFoundException({ code: 'offer.not_found', message: 'Offer not found.' });
    }

    const [listing] = (await queryRunner.query(
      `SELECT id FROM listings WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [offerRef.listing_id],
    )) as Array<{ id: string }>;
    if (!listing) {
      throw new NotFoundException({ code: 'offer.not_found', message: 'Offer not found.' });
    }

    const [offer] = (await queryRunner.query(
      `SELECT o.id, o.listing_id, o.buyer_id, o.status, o.last_actor,
              l.seller_id, l.status AS listing_status
         FROM trade_offers o
         JOIN listings l ON l.id = o.listing_id
        WHERE o.id = $1
          AND l.deleted_at IS NULL
          AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = l.seller_id AND ub.blocked_id = o.buyer_id)
                    OR (ub.blocker_id = o.buyer_id AND ub.blocked_id = l.seller_id)
              )
        FOR UPDATE OF o`,
      [offerId],
    )) as Array<LockedOfferRow>;
    if (!offer) {
      throw new NotFoundException({ code: 'offer.not_found', message: 'Offer not found.' });
    }
    return offer;
  }

  async uploadImage(
    userId: string,
    data: string,
    contentType: string,
  ): Promise<UploadListingImageResponse> {
    const buffer = Buffer.from(data, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException({
        code: 'listing.image_empty',
        message: 'Image data is empty or not valid base64.',
      });
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException({
        code: 'listing.image_too_large',
        message: 'Image exceeds the 10 MB limit.',
      });
    }
    const url = await this.s3.uploadListingImageBuffer(userId, buffer, contentType);
    return { url };
  }

  async create(sellerId: string, dto: CreateListingDto): Promise<ListingSummary> {
    const cells = computeH3Cells(dto.location.lat, dto.location.lng);
    const mode = dto.mode === 'buy' ? 'buy' : 'sell';
    const ttlDays = mode === 'buy' ? LISTING_LIMITS.ttlDaysBuy : LISTING_LIMITS.ttlDaysSell;
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
    const rows = (await this.db.query(
      `INSERT INTO listings
         (seller_id, title, description, thumbnail_url, price_cents, currency, category, visibility, mode,
          expires_at,
          location, location_h3_r4, location_h3_r5, location_h3_r6,
          location_h3_r7, location_h3_r8, location_h3_r9, location_h3_r10)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10,
          ST_SetSRID(ST_MakePoint($11, $12), 4326)::geography,
          $13, $14, $15, $16, $17, $18, $19)
       RETURNING id, seller_id, title, thumbnail_url, price_cents, currency, category, status, mode,
                 created_at, expires_at, bumped_at,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`,
      [
        sellerId, dto.title, dto.description ?? null, dto.thumbnailUrl ?? null, dto.priceCents,
        dto.currency ?? 'USD', dto.category, dto.visibility ?? 'public', mode,
        expiresAt,
        dto.location.lng, dto.location.lat,
        cells.r4, cells.r5, cells.r6, cells.r7, cells.r8, cells.r9, cells.r10,
      ],
    )) as ListingRow[];
    const summary = this.toSummary({ ...rows[0]!, favorited_by_me: false });
    if ((dto.visibility ?? 'public') === 'public') {
      void this.notifications
        .notifyListingNearby(cells.r7, sellerId, summary.title, summary.id)
        .catch(() => undefined);
    }
    return summary;
  }

  async browse(userId: string, dto: BrowseListingsDto): Promise<ListingSummary[]> {
    const radiusM = dto.radiusM ?? 5_000;
    const limit = dto.limit ?? 50;
    const rows = (await this.db.query(
      `SELECT l.id, l.seller_id, l.title, l.thumbnail_url, l.price_cents, l.currency,
              l.category, l.status, l.mode, l.created_at, l.expires_at, l.bumped_at,
              ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
              (f.user_id IS NOT NULL) AS favorited_by_me
         FROM listings l
         LEFT JOIN trade_favorites f ON f.listing_id = l.id AND f.user_id = $1
        WHERE l.deleted_at IS NULL
          AND l.status = 'active'
          AND (l.expires_at IS NULL OR l.expires_at > NOW())
          AND (l.visibility = 'public' OR l.seller_id = $1)
          AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $1 AND ub.blocked_id = l.seller_id)
                    OR (ub.blocker_id = l.seller_id AND ub.blocked_id = $1)
              )
          AND ($5::text IS NULL OR l.category = $5)
          AND ($7::text IS NULL OR l.mode = $7)
          AND ST_DWithin(
                l.location,
                ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                $4)
        ORDER BY l.created_at DESC
        LIMIT $6`,
      [userId, dto.location.lng, dto.location.lat, radiusM, dto.category ?? null, limit, dto.mode ?? null],
    )) as ListingRow[];
    return rows.map((r) => this.toSummary(r));
  }

  async detail(userId: string, listingId: string): Promise<ListingDetail> {
    const [row] = (await this.db.query(
      `SELECT l.id, l.seller_id, l.title, l.description, l.thumbnail_url, l.price_cents,
              l.currency, l.category, l.status, l.mode, l.marketplace_kind, l.visibility, l.created_at,
              l.expires_at, l.bumped_at,
              ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
              s.display_name AS seller_display_name, s.avatar_url AS seller_avatar_url,
              (f.user_id IS NOT NULL) AS favorited_by_me,
              (SELECT COUNT(*)
                 FROM trade_favorites tf
                WHERE tf.listing_id = l.id
                  AND NOT EXISTS (
                        SELECT 1 FROM user_blocks ub
                         WHERE (ub.blocker_id = l.seller_id AND ub.blocked_id = tf.user_id)
                            OR (ub.blocker_id = tf.user_id AND ub.blocked_id = l.seller_id)
                      ))::int AS favorite_count
         FROM listings l
         JOIN users s ON s.id = l.seller_id
         LEFT JOIN trade_favorites f ON f.listing_id = l.id AND f.user_id = $1
        WHERE l.id = $2
          AND l.deleted_at IS NULL
          AND (l.visibility = 'public' OR l.seller_id = $1)
          AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $1 AND ub.blocked_id = l.seller_id)
                    OR (ub.blocker_id = l.seller_id AND ub.blocked_id = $1)
              )`,
      [userId, listingId],
    )) as Array<ListingRow & {
      description: string | null;
      visibility: 'public' | 'private';
      seller_display_name: string;
      seller_avatar_url: string | null;
      favorite_count: number;
    }>;
    if (!row) throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
    const isSeller = row.seller_id === userId;
    const [mine] = (await this.db.query(
      `SELECT o.id, o.listing_id, o.buyer_id, o.offer_cents, o.message, o.status, o.last_actor, o.created_at,
              u.display_name AS buyer_display_name, u.avatar_url AS buyer_avatar_url
         FROM trade_offers o
         JOIN users u ON u.id = o.buyer_id
        WHERE o.listing_id = $1 AND o.buyer_id = $2`,
      [listingId, userId],
    )) as OfferRow[];
    let openOffers = 0;
    if (isSeller) {
      const openRows = (await this.db.query(
        `SELECT COUNT(*)::int AS open_offers
           FROM trade_offers o
          WHERE o.listing_id = $1
            AND o.status = 'pending'
            AND NOT EXISTS (
                  SELECT 1 FROM user_blocks ub
                   WHERE (ub.blocker_id = $2 AND ub.blocked_id = o.buyer_id)
                      OR (ub.blocker_id = o.buyer_id AND ub.blocked_id = $2)
                )`,
        [listingId, userId],
      )) as Array<{ open_offers: number }>;
      openOffers = openRows[0]?.open_offers ?? 0;
    }
    return {
      ...this.toSummary(row),
      description: row.description,
      visibility: row.visibility,
      sellerDisplayName: row.seller_display_name,
      sellerAvatarUrl: row.seller_avatar_url,
      favoriteCount: row.favorite_count,
      marketplaceKind: row.mode === 'sell' ? row.marketplace_kind ?? 'for_sale' : null,
      myOffer: mine ? this.toOffer(mine) : null,
      offerCount: openOffers,
    };
  }

  async updateStatus(userId: string, listingId: string, status: ListingStatus): Promise<ListingDetail> {
    await this.withMarketplaceTransaction(async (qr) => {
      // Serialize all listing/offer lifecycle mutations on the listing row first.
      const [listing] = (await qr.query(
        `SELECT id, seller_id, status FROM listings
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [listingId],
      )) as Array<{ id: string; seller_id: string; status: ListingStatus }>;
      if (!listing) {
        throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
      }
      if (listing.seller_id !== userId) {
        throw new ForbiddenException({
          code: 'listing.not_seller', message: 'Only the seller can update this listing.',
        });
      }

      if (listing.status !== status) {
        // Manual sold is supported, but terminal listings cannot be reopened.
        if (listing.status !== 'active' || status === 'active') {
          throw new ConflictException({
            code: 'listing.invalid_status_transition',
            message: 'This listing cannot change to the requested status.',
          });
        }
        const changed = (await qr.query(
          `UPDATE listings SET status = $2, updated_at = NOW()
            WHERE id = $1 AND seller_id = $3 AND status = 'active' AND deleted_at IS NULL
            RETURNING id`,
          [listingId, status, userId],
        )) as [Array<{ id: string }>, number];
        if (!Array.isArray(changed[0]) || changed[0].length !== 1) {
          throw new ConflictException({
            code: 'listing.not_active', message: 'This listing is no longer active.',
          });
        }

        // Manual sold/withdrawn must not leave actionable pending offers behind.
        await qr.query(
          `UPDATE trade_offers SET status = 'declined', updated_at = NOW()
            WHERE listing_id = $1 AND status = 'pending'`,
          [listingId],
        );
      }
    });
    return this.detail(userId, listingId);
  }

  async makeOffer(buyerId: string, listingId: string, dto: MakeOfferDto): Promise<ListingOffer> {
    await this.withMarketplaceTransaction(async (qr) => {
      // Every offer mutation acquires the listing lock before modifying an offer.
      const [listing] = (await qr.query(
        `SELECT l.seller_id, l.status
           FROM listings l
          WHERE l.id = $1
            AND l.deleted_at IS NULL
            AND (l.visibility = 'public' OR l.seller_id = $2)
            AND NOT EXISTS (
                  SELECT 1 FROM user_blocks ub
                   WHERE (ub.blocker_id = $2 AND ub.blocked_id = l.seller_id)
                      OR (ub.blocker_id = l.seller_id AND ub.blocked_id = $2)
                )
          FOR UPDATE OF l`,
        [listingId, buyerId],
      )) as Array<{ seller_id: string; status: ListingStatus }>;
      if (!listing) {
        throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
      }
      if (listing.seller_id === buyerId) {
        throw new ForbiddenException({
          code: 'listing.own_offer',
          message: "You can't make an offer on your own listing.",
        });
      }
      if (listing.status !== 'active') {
        throw new ConflictException({
          code: 'listing.not_active',
          message: 'This listing is no longer accepting offers.',
        });
      }
      const upserted = (await qr.query(
        `INSERT INTO trade_offers (listing_id, buyer_id, offer_cents, message, status, last_actor)
              VALUES ($1, $2, $3, $4, 'pending', 'buyer')
         ON CONFLICT (listing_id, buyer_id)
         DO UPDATE SET offer_cents = EXCLUDED.offer_cents,
                       message     = EXCLUDED.message,
                       status      = 'pending',
                       last_actor  = 'buyer',
                       updated_at  = NOW()
          WHERE trade_offers.status = 'pending'
          RETURNING id`,
        [listingId, buyerId, dto.offerCents ?? null, dto.message ?? null],
      )) as [Array<{ id: string }>, number];
      if (!Array.isArray(upserted[0]) || upserted[0].length !== 1) {
        throw new ConflictException({
          code: 'offer.not_pending',
          message: 'A completed offer cannot be reopened.',
        });
      }
    });
    return this.getOffer(listingId, buyerId);
  }

  async counterOffer(
    sellerId: string,
    offerId: string,
    dto: CounterOfferDto,
  ): Promise<ListingOffer> {
    await this.withMarketplaceTransaction(async (qr) => {
      const row = await this.lockOfferForUpdate(qr, offerId);
      if (row.seller_id !== sellerId) {
        throw new ForbiddenException({
          code: 'offer.not_seller',
          message: 'Only the seller can counter this offer.',
        });
      }
      if (row.listing_status !== 'active') {
        throw new ConflictException({
          code: 'listing.not_active',
          message: 'This listing is no longer accepting negotiation.',
        });
      }
      if (row.status !== 'pending') {
        throw new ConflictException({
          code: 'offer.not_pending',
          message: 'Only pending offers can be countered.',
        });
      }
      const updated = (await qr.query(
        `UPDATE trade_offers
            SET offer_cents = $2,
                message     = $3,
                status      = 'pending',
                last_actor  = 'seller',
                updated_at  = NOW()
          WHERE id = $1 AND status = 'pending'
          RETURNING id`,
        [offerId, dto.offerCents, dto.message ?? null],
      )) as [Array<{ id: string }>, number];
      if (!Array.isArray(updated[0]) || updated[0].length !== 1) {
        throw new ConflictException({
          code: 'offer.not_pending',
          message: 'Only pending offers can be countered.',
        });
      }
    });
    return this.getOfferById(offerId);
  }

  async listOffers(userId: string, listingId: string): Promise<ListingOffer[]> {
    const listing = await this.assertListingAccessible(userId, listingId);
    const isSeller = listing.seller_id === userId;
    const rows = (await this.db.query(
      `SELECT o.id, o.listing_id, o.buyer_id, o.offer_cents, o.message, o.status, o.last_actor, o.created_at,
              u.display_name AS buyer_display_name, u.avatar_url AS buyer_avatar_url
         FROM trade_offers o
         JOIN users u ON u.id = o.buyer_id
        WHERE o.listing_id = $1
          ${isSeller ? `AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $2 AND ub.blocked_id = o.buyer_id)
                    OR (ub.blocker_id = o.buyer_id AND ub.blocked_id = $2)
              )` : 'AND o.buyer_id = $2'}
        ORDER BY o.created_at DESC
        LIMIT ${OFFER_PREVIEW}`,
      [listingId, userId],
    )) as OfferRow[];
    return rows.map((o) => this.toOffer(o));
  }

  /**
   * Accept or decline a pending offer.
   * - Seller: always (buyer moved last, or cancel own counter).
   * - Buyer: only when last_actor=seller (accept/decline the counter).
   * Accept sells the listing and declines other pending offers.
   */
  async respondToOffer(
    userId: string,
    offerId: string,
    status: 'accepted' | 'declined',
  ): Promise<ListingOffer> {
    await this.withMarketplaceTransaction(async (qr) => {
      const offer = await this.lockOfferForUpdate(qr, offerId);
      if (offer.status !== 'pending') {
        throw new ConflictException({
          code: 'offer.not_pending',
          message: 'Only pending offers can be accepted or declined.',
        });
      }
      if (offer.listing_status !== 'active') {
        throw new ConflictException({
          code: 'listing.not_active',
          message: 'This listing is no longer accepting negotiation.',
        });
      }
      const isSeller = offer.seller_id === userId;
      const isBuyer = offer.buyer_id === userId;
      const waitingOnBuyer = offer.last_actor === 'seller';
      if (isSeller) {
        // Seller may always answer a buyer offer or their own counter.
      } else if (isBuyer && waitingOnBuyer) {
        // Buyer may answer only after the seller has made a counter.
      } else if (isBuyer) {
        throw new ForbiddenException({
          code: 'offer.not_your_turn',
          message: 'Wait for the seller to respond, or withdraw and re-offer.',
        });
      } else {
        throw new ForbiddenException({
          code: 'offer.forbidden',
          message: 'You cannot respond to this offer.',
        });
      }

      const changed = (await qr.query(
        `UPDATE trade_offers
            SET status = $2, updated_at = NOW()
          WHERE id = $1 AND status = 'pending'
          RETURNING id`,
        [offerId, status],
      )) as [Array<{ id: string }>, number];
      if (!Array.isArray(changed[0]) || changed[0].length !== 1) {
        throw new ConflictException({
          code: 'offer.not_pending',
          message: 'Only pending offers can be accepted or declined.',
        });
      }
      if (status === 'accepted') {
        const soldResult = (await qr.query(
          `UPDATE listings
              SET status = 'sold', updated_at = NOW()
            WHERE id = $1
              AND status = 'active'
              AND deleted_at IS NULL
            RETURNING id`,
          [offer.listing_id],
        )) as [Array<{ id: string }>, number];
        if (!Array.isArray(soldResult[0]) || soldResult[0].length !== 1) {
          throw new ConflictException({
            code: 'listing.not_active',
            message: 'This listing is no longer accepting offers.',
          });
        }
        await qr.query(
          `UPDATE trade_offers SET status = 'declined', updated_at = NOW()
            WHERE listing_id = $1 AND id <> $2 AND status = 'pending'`,
          [offer.listing_id, offerId],
        );
      }
    });
    return this.getOfferById(offerId);
  }

  async withdrawOffer(buyerId: string, listingId: string): Promise<ListingOffer> {
    await this.withMarketplaceTransaction(async (qr) => {
      // Always lock the listing before locking a specific offer.
      const [listing] = (await qr.query(
        `SELECT id, status FROM listings WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [listingId],
      )) as Array<{ id: string; status: ListingStatus }>;
      if (!listing) {
        throw new NotFoundException({ code: 'offer.not_found', message: 'You have no offer to withdraw.' });
      }

      const [offer] = (await qr.query(
        `SELECT id, status FROM trade_offers
          WHERE listing_id = $1 AND buyer_id = $2 FOR UPDATE`,
        [listingId, buyerId],
      )) as Array<{ id: string; status: OfferStatus }>;
      if (!offer) {
        throw new NotFoundException({ code: 'offer.not_found', message: 'You have no offer to withdraw.' });
      }
      if (listing.status !== 'active') {
        throw new ConflictException({
          code: 'listing.not_active',
          message: 'This listing is no longer accepting negotiation.',
        });
      }
      if (offer.status !== 'pending') {
        throw new ConflictException({
          code: 'offer.not_pending',
          message: 'Only pending offers can be withdrawn.',
        });
      }

      const withdrawn = (await qr.query(
        `UPDATE trade_offers SET status = 'withdrawn', updated_at = NOW()
          WHERE id = $1 AND listing_id = $2 AND buyer_id = $3 AND status = 'pending'
          RETURNING id`,
        [offer.id, listingId, buyerId],
      )) as [Array<{ id: string }>, number];
      if (!Array.isArray(withdrawn[0]) || withdrawn[0].length !== 1) {
        throw new ConflictException({
          code: 'offer.not_pending',
          message: 'Only pending offers can be withdrawn.',
        });
      }
    });
    return this.getOffer(listingId, buyerId);
  }
  async toggleFavorite(userId: string, listingId: string): Promise<ToggleFavoriteResponse> {
    await this.assertListingAccessible(userId, listingId);
    const [existing] = (await this.db.query(
      `SELECT 1 AS x FROM trade_favorites WHERE listing_id = $1 AND user_id = $2`,
      [listingId, userId],
    )) as Array<{ x: number }>;
    let favorited: boolean;
    if (existing) {
      await this.db.query(
        `DELETE FROM trade_favorites WHERE listing_id = $1 AND user_id = $2`,
        [listingId, userId],
      );
      favorited = false;
    } else {
      await this.db.query(
        `INSERT INTO trade_favorites (listing_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [listingId, userId],
      );
      favorited = true;
    }
    const countRows = (await this.db.query(
      `SELECT COUNT(*)::int AS count
         FROM trade_favorites tf
        WHERE tf.listing_id = $1
          AND NOT EXISTS (
                SELECT 1
                  FROM listings l
                  JOIN user_blocks ub
                    ON (ub.blocker_id = l.seller_id AND ub.blocked_id = tf.user_id)
                    OR (ub.blocker_id = tf.user_id AND ub.blocked_id = l.seller_id)
                 WHERE l.id = tf.listing_id
              )`,
      [listingId],
    )) as Array<{ count: number }>;
    return { listingId, favorited, favoriteCount: countRows[0]?.count ?? 0 };
  }

  async listFavorites(userId: string): Promise<ListingSummary[]> {
    const rows = (await this.db.query(
      `SELECT l.id, l.seller_id, l.title, l.thumbnail_url, l.price_cents, l.currency,
              l.category, l.status, l.mode, l.created_at, l.expires_at, l.bumped_at,
              ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
              true AS favorited_by_me
         FROM trade_favorites f
         JOIN listings l ON l.id = f.listing_id AND l.deleted_at IS NULL
        WHERE f.user_id = $1
          AND (l.visibility = 'public' OR l.seller_id = $1)
          AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $1 AND ub.blocked_id = l.seller_id)
                    OR (ub.blocker_id = l.seller_id AND ub.blocked_id = $1)
              )
        ORDER BY f.created_at DESC
        LIMIT 100`,
      [userId],
    )) as ListingRow[];
    return rows.map((r) => this.toSummary(r));
  }

  /**
   * Seller extends expires_at (bump). Rate-limited: min hours between bumps,
   * max bumps per rolling day. Keeps status active.
   */
  async bump(userId: string, listingId: string): Promise<ListingDetail> {
    await this.assertSeller(userId, listingId);
    const [row] = (await this.db.query(
      `SELECT status, expires_at, bumped_at, mode FROM listings
        WHERE id = $1 AND deleted_at IS NULL`,
      [listingId],
    )) as Array<{
      status: ListingStatus;
      expires_at: Date | null;
      bumped_at: Date | null;
      mode: 'sell' | 'buy';
    }>;
    if (!row) {
      throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
    }
    if (row.status !== 'active') {
      throw new ConflictException({
        code: 'listing.not_active',
        message: 'Only active listings can be bumped.',
      });
    }
    const now = Date.now();
    if (row.bumped_at) {
      const hours = (now - new Date(row.bumped_at).getTime()) / 3_600_000;
      if (hours < LISTING_LIMITS.bumpCooldownHours) {
        throw new ConflictException({
          code: 'listing.bump_cooldown',
          message: `Wait ${LISTING_LIMITS.bumpCooldownHours}h between bumps.`,
        });
      }
    }
    const extendDays = LISTING_LIMITS.bumpExtendDays;
    const base = row.expires_at && new Date(row.expires_at).getTime() > now
      ? new Date(row.expires_at).getTime()
      : now;
    const newExpires = new Date(base + extendDays * 86_400_000);
    await this.db.query(
      `UPDATE listings
          SET expires_at = $2, bumped_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [listingId, newExpires],
    );
    return this.detail(userId, listingId);
  }

  private async assertListingAccessible(
    userId: string,
    listingId: string,
  ): Promise<{ seller_id: string }> {
    const [listing] = (await this.db.query(
      `SELECT l.seller_id
         FROM listings l
        WHERE l.id = $2
          AND l.deleted_at IS NULL
          AND (l.visibility = 'public' OR l.seller_id = $1)
          AND NOT EXISTS (
                SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $1 AND ub.blocked_id = l.seller_id)
                    OR (ub.blocker_id = l.seller_id AND ub.blocked_id = $1)
              )`,
      [userId, listingId],
    )) as Array<{ seller_id: string }>;
    if (!listing) {
      throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
    }
    return listing;
  }

  private async assertSeller(userId: string, listingId: string): Promise<void> {
    const [listing] = (await this.db.query(
      `SELECT seller_id FROM listings WHERE id = $1 AND deleted_at IS NULL`,
      [listingId],
    )) as Array<{ seller_id: string }>;
    if (!listing) {
      throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
    }
    if (listing.seller_id !== userId) {
      throw new ForbiddenException({
        code: 'listing.not_seller',
        message: 'Only the seller can do that.',
      });
    }
  }

  private async getOffer(listingId: string, buyerId: string): Promise<ListingOffer> {
    const [row] = (await this.db.query(
      `SELECT o.id, o.listing_id, o.buyer_id, o.offer_cents, o.message, o.status, o.last_actor, o.created_at,
              u.display_name AS buyer_display_name, u.avatar_url AS buyer_avatar_url
         FROM trade_offers o
         JOIN users u ON u.id = o.buyer_id
        WHERE o.listing_id = $1 AND o.buyer_id = $2`,
      [listingId, buyerId],
    )) as OfferRow[];
    if (!row) throw new NotFoundException({ code: 'offer.not_found', message: 'Offer not found.' });
    return this.toOffer(row);
  }

  private async getOfferById(offerId: string): Promise<ListingOffer> {
    const [row] = (await this.db.query(
      `SELECT o.id, o.listing_id, o.buyer_id, o.offer_cents, o.message, o.status, o.last_actor, o.created_at,
              u.display_name AS buyer_display_name, u.avatar_url AS buyer_avatar_url
         FROM trade_offers o
         JOIN users u ON u.id = o.buyer_id
        WHERE o.id = $1`,
      [offerId],
    )) as OfferRow[];
    if (!row) throw new NotFoundException({ code: 'offer.not_found', message: 'Offer not found.' });
    return this.toOffer(row);
  }

  private toSummary(row: ListingRow): ListingSummary {
    return {
      id: row.id,
      sellerId: row.seller_id,
      title: row.title,
      thumbnailUrl: row.thumbnail_url,
      priceCents: row.price_cents,
      currency: row.currency,
      category: row.category,
      status: row.status,
      mode: row.mode === 'buy' ? 'buy' : 'sell',
      location: { lat: row.lat, lng: row.lng },
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      bumpedAt: row.bumped_at ? new Date(row.bumped_at).toISOString() : null,
      favoritedByMe: row.favorited_by_me,
    };
  }

  private toOffer(row: OfferRow): ListingOffer {
    const actor = row.last_actor;
    return {
      id: row.id,
      listingId: row.listing_id,
      buyerId: row.buyer_id,
      buyerDisplayName: row.buyer_display_name,
      buyerAvatarUrl: row.buyer_avatar_url,
      offerCents: row.offer_cents,
      message: row.message,
      status: row.status,
      lastActor: actor === 'buyer' || actor === 'seller' ? actor : null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
