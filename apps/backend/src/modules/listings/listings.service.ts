import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  computeH3Cells,
  type ListingDetail,
  type ListingOffer,
  type ListingStatus,
  type ListingSummary,
  type OfferStatus,
  type ToggleFavoriteResponse,
} from '@g88/shared';

import {
  BrowseListingsDto,
  CreateListingDto,
  MakeOfferDto,
} from './dto';

/** Max offers inlined into a seller's listing detail. */
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
  lat: number;
  lng: number;
  created_at: Date;
  favorited_by_me: boolean;
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
  created_at: Date;
}

@Injectable()
export class ListingsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ─── Create / read ─────────────────────────────────────────────────────────

  async create(sellerId: string, dto: CreateListingDto): Promise<ListingSummary> {
    // A listing's location is the seller-published whereabouts of the item, not
    // tracked personal position — stored precisely with app-computed H3 cells.
    const cells = computeH3Cells(dto.location.lat, dto.location.lng);

    const rows = (await this.db.query(
      `INSERT INTO listings
         (seller_id, title, description, thumbnail_url, price_cents, currency, category, visibility,
          location, location_h3_r4, location_h3_r5, location_h3_r6,
          location_h3_r7, location_h3_r8, location_h3_r9, location_h3_r10)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8,
          ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
          $11, $12, $13, $14, $15, $16, $17)
       RETURNING id, seller_id, title, thumbnail_url, price_cents, currency, category, status,
                 created_at, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`,
      [
        sellerId,
        dto.title,
        dto.description ?? null,
        dto.thumbnailUrl ?? null,
        dto.priceCents,
        dto.currency ?? 'USD',
        dto.category,
        dto.visibility ?? 'public',
        dto.location.lng,
        dto.location.lat,
        cells.r4, cells.r5, cells.r6, cells.r7, cells.r8, cells.r9, cells.r10,
      ],
    )) as ListingRow[];

    return this.toSummary({ ...rows[0]!, favorited_by_me: false });
  }

  async browse(userId: string, dto: BrowseListingsDto): Promise<ListingSummary[]> {
    const radiusM = dto.radiusM ?? 5_000;
    const limit = dto.limit ?? 50;

    const rows = (await this.db.query(
      `SELECT l.id, l.seller_id, l.title, l.thumbnail_url, l.price_cents, l.currency,
              l.category, l.status, l.created_at,
              ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
              (f.user_id IS NOT NULL) AS favorited_by_me
         FROM listings l
         LEFT JOIN trade_favorites f ON f.listing_id = l.id AND f.user_id = $1
        WHERE l.deleted_at IS NULL
          AND l.status = 'active'
          AND (l.visibility = 'public' OR l.seller_id = $1)
          AND ($5::text IS NULL OR l.category = $5)
          AND ST_DWithin(
                l.location,
                ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                $4)
        ORDER BY l.created_at DESC
        LIMIT $6`,
      [userId, dto.location.lng, dto.location.lat, radiusM, dto.category ?? null, limit],
    )) as ListingRow[];

    return rows.map((r) => this.toSummary(r));
  }

  async detail(userId: string, listingId: string): Promise<ListingDetail> {
    const [row] = (await this.db.query(
      `SELECT l.id, l.seller_id, l.title, l.description, l.thumbnail_url, l.price_cents,
              l.currency, l.category, l.status, l.visibility, l.created_at,
              ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
              s.display_name AS seller_display_name, s.avatar_url AS seller_avatar_url,
              (f.user_id IS NOT NULL) AS favorited_by_me,
              (SELECT COUNT(*) FROM trade_favorites tf WHERE tf.listing_id = l.id)::int AS favorite_count
         FROM listings l
         JOIN users s ON s.id = l.seller_id
         LEFT JOIN trade_favorites f ON f.listing_id = l.id AND f.user_id = $1
        WHERE l.id = $2 AND l.deleted_at IS NULL`,
      [userId, listingId],
    )) as Array<ListingRow & {
      description: string | null;
      visibility: 'public' | 'private';
      seller_display_name: string;
      seller_avatar_url: string | null;
      favorite_count: number;
    }>;

    if (!row) throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
    if (row.visibility === 'private' && row.seller_id !== userId) {
      throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
    }

    const isSeller = row.seller_id === userId;

    const [mine] = (await this.db.query(
      `SELECT o.id, o.listing_id, o.buyer_id, o.offer_cents, o.message, o.status, o.created_at,
              u.display_name AS buyer_display_name, u.avatar_url AS buyer_avatar_url
         FROM trade_offers o
         JOIN users u ON u.id = o.buyer_id
        WHERE o.listing_id = $1 AND o.buyer_id = $2`,
      [listingId, userId],
    )) as OfferRow[];

    const openRows = (await this.db.query(
      `SELECT COUNT(*)::int AS open_offers FROM trade_offers
        WHERE listing_id = $1 AND status = 'pending'`,
      [listingId],
    )) as Array<{ open_offers: number }>;
    const openOffers = openRows[0]?.open_offers ?? 0;

    return {
      ...this.toSummary(row),
      description: row.description,
      visibility: row.visibility,
      sellerDisplayName: row.seller_display_name,
      sellerAvatarUrl: row.seller_avatar_url,
      favoriteCount: row.favorite_count,
      myOffer: mine ? this.toOffer(mine) : null,
      offerCount: isSeller ? openOffers : 0,
    };
  }

  async updateStatus(userId: string, listingId: string, status: ListingStatus): Promise<ListingDetail> {
    await this.assertSeller(userId, listingId);
    await this.db.query(
      `UPDATE listings SET status = $2, updated_at = NOW() WHERE id = $1`,
      [listingId, status],
    );
    return this.detail(userId, listingId);
  }

  // ─── Offers ──────────────────────────────────────────────────────────────────

  async makeOffer(buyerId: string, listingId: string, dto: MakeOfferDto): Promise<ListingOffer> {
    const [listing] = (await this.db.query(
      `SELECT seller_id, status FROM listings WHERE id = $1 AND deleted_at IS NULL`,
      [listingId],
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

    // One offer per buyer per listing; re-offering re-opens it as pending.
    await this.db.query(
      `INSERT INTO trade_offers (listing_id, buyer_id, offer_cents, message, status)
            VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (listing_id, buyer_id)
       DO UPDATE SET offer_cents = EXCLUDED.offer_cents,
                     message     = EXCLUDED.message,
                     status      = 'pending',
                     updated_at  = NOW()`,
      [listingId, buyerId, dto.offerCents ?? null, dto.message ?? null],
    );

    return this.getOffer(listingId, buyerId);
  }

  async listOffers(userId: string, listingId: string): Promise<ListingOffer[]> {
    const [listing] = (await this.db.query(
      `SELECT seller_id FROM listings WHERE id = $1 AND deleted_at IS NULL`,
      [listingId],
    )) as Array<{ seller_id: string }>;
    if (!listing) {
      throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
    }

    // Seller sees every offer; a buyer sees only their own.
    const scope = listing.seller_id === userId ? '' : 'AND o.buyer_id = $2';
    const rows = (await this.db.query(
      `SELECT o.id, o.listing_id, o.buyer_id, o.offer_cents, o.message, o.status, o.created_at,
              u.display_name AS buyer_display_name, u.avatar_url AS buyer_avatar_url
         FROM trade_offers o
         JOIN users u ON u.id = o.buyer_id
        WHERE o.listing_id = $1 ${scope}
        ORDER BY o.created_at DESC
        LIMIT ${OFFER_PREVIEW}`,
      [listingId, userId],
    )) as OfferRow[];

    return rows.map((o) => this.toOffer(o));
  }

  async respondToOffer(
    sellerId: string,
    offerId: string,
    status: 'accepted' | 'declined',
  ): Promise<ListingOffer> {
    const qr = this.db.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [offer] = await qr.query(
        `SELECT o.listing_id, o.buyer_id, l.seller_id
           FROM trade_offers o
           JOIN listings l ON l.id = o.listing_id
          WHERE o.id = $1
          FOR UPDATE OF o`,
        [offerId],
      );
      if (!offer) {
        throw new NotFoundException({ code: 'offer.not_found', message: 'Offer not found.' });
      }
      if (offer.seller_id !== sellerId) {
        throw new ForbiddenException({
          code: 'offer.not_seller',
          message: 'Only the seller can respond to this offer.',
        });
      }

      await qr.query(
        `UPDATE trade_offers SET status = $2, updated_at = NOW() WHERE id = $1`,
        [offerId, status],
      );

      // Accepting an offer sells the listing and declines the rest.
      if (status === 'accepted') {
        await qr.query(
          `UPDATE listings SET status = 'sold', updated_at = NOW() WHERE id = $1`,
          [offer.listing_id],
        );
        await qr.query(
          `UPDATE trade_offers SET status = 'declined', updated_at = NOW()
            WHERE listing_id = $1 AND id <> $2 AND status = 'pending'`,
          [offer.listing_id, offerId],
        );
      }

      await qr.commitTransaction();
      return this.getOfferById(offerId);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async withdrawOffer(buyerId: string, listingId: string): Promise<ListingOffer> {
    const [existing] = (await this.db.query(
      `SELECT id FROM trade_offers WHERE listing_id = $1 AND buyer_id = $2`,
      [listingId, buyerId],
    )) as Array<{ id: string }>;
    if (!existing) {
      throw new NotFoundException({ code: 'offer.not_found', message: 'You have no offer to withdraw.' });
    }
    await this.db.query(
      `UPDATE trade_offers SET status = 'withdrawn', updated_at = NOW()
        WHERE listing_id = $1 AND buyer_id = $2`,
      [listingId, buyerId],
    );
    return this.getOffer(listingId, buyerId);
  }

  // ─── Favorites ────────────────────────────────────────────────────────────

  async toggleFavorite(userId: string, listingId: string): Promise<ToggleFavoriteResponse> {
    const [listing] = (await this.db.query(
      `SELECT id FROM listings WHERE id = $1 AND deleted_at IS NULL`,
      [listingId],
    )) as Array<{ id: string }>;
    if (!listing) {
      throw new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' });
    }

    // Check-then-act rather than DELETE ... RETURNING (TypeORM's query() returns
    // an ambiguous [rows, affected] tuple for UPDATE/DELETE — see events fix).
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
      `SELECT COUNT(*)::int AS count FROM trade_favorites WHERE listing_id = $1`,
      [listingId],
    )) as Array<{ count: number }>;

    return { listingId, favorited, favoriteCount: countRows[0]?.count ?? 0 };
  }

  async listFavorites(userId: string): Promise<ListingSummary[]> {
    const rows = (await this.db.query(
      `SELECT l.id, l.seller_id, l.title, l.thumbnail_url, l.price_cents, l.currency,
              l.category, l.status, l.created_at,
              ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
              true AS favorited_by_me
         FROM trade_favorites f
         JOIN listings l ON l.id = f.listing_id AND l.deleted_at IS NULL
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
        LIMIT 100`,
      [userId],
    )) as ListingRow[];
    return rows.map((r) => this.toSummary(r));
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

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
      `SELECT o.id, o.listing_id, o.buyer_id, o.offer_cents, o.message, o.status, o.created_at,
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
      `SELECT o.id, o.listing_id, o.buyer_id, o.offer_cents, o.message, o.status, o.created_at,
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
      location: { lat: row.lat, lng: row.lng },
      createdAt: new Date(row.created_at).toISOString(),
      favoritedByMe: row.favorited_by_me,
    };
  }

  private toOffer(row: OfferRow): ListingOffer {
    return {
      id: row.id,
      listingId: row.listing_id,
      buyerId: row.buyer_id,
      buyerDisplayName: row.buyer_display_name,
      buyerAvatarUrl: row.buyer_avatar_url,
      offerCents: row.offer_cents,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
