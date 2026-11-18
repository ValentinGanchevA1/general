/**
 * NEXUS Stage D3: REAL ListingsService / PostgreSQL concurrency tests.
 * Opt-in only. Never point this suite at a non-disposable database.
 *
 * Run via NEXUS_stageD3_run.ps1 from a Windows host with the private Docker
 * loopback proxy. The suite validates the server identity BEFORE any DDL.
 *
 * The isolated schema intentionally substitutes PostgreSQL point/domain
 * for the unused PostGIS location representation: this suite exercises
 * Marketplace row-lock, transition and rollback SQL, NOT spatial queries.
 */
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ListingsService } from './listings.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { S3Service } from '../../common/s3.service';

const enabled = process.env.NEXUS_D3_RUN === '1' || process.env.NEXUS_D5_CI_RUN === '1';
const suite = enabled ? describe : describe.skip;

interface OfferState {
  id: string;
  buyer_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  offer_cents: number | null;
  last_actor: 'buyer' | 'seller' | null;
}

suite('NEXUS Stage D3 Marketplace concurrency (disposable PostgreSQL only)', () => {
  const schema = `nexus_d3_${randomUUID().replaceAll('-', '')}`;
  const seller = randomUUID();
  const buyerA = randomUUID();
  const buyerB = randomUUID();
  let listingId = randomUUID();
  let offerA = randomUUID();
  let offerB = randomUUID();
  let root: DataSource;
  let db: DataSource;
  let service: ListingsService;
  let schemaCreated = false;

  async function snapshot(): Promise<{ listing: string; offers: OfferState[] }> {
    const [listing] = (await db.query(
      'SELECT status FROM listings WHERE id = $1', [listingId],
    )) as Array<{ status: string }>;
    const offers = (await db.query(
      'SELECT id, buyer_id, status, offer_cents, last_actor FROM trade_offers WHERE listing_id = $1 ORDER BY buyer_id',
      [listingId],
    )) as OfferState[];
    if (!listing) throw new Error('D3 fixture listing missing');
    return { listing: listing.status, offers };
  }

  function acceptedCount(offers: OfferState[]): number {
    return offers.filter((offer) => offer.status === 'accepted').length;
  }

  function assertTerminalConsistency(state: { listing: string; offers: OfferState[] }): void {
    expect(acceptedCount(state.offers)).toBeLessThanOrEqual(1);
    if (state.listing !== 'active') {
      expect(state.offers.every((offer) => offer.status !== 'pending')).toBe(true);
    }
    if (acceptedCount(state.offers) === 1) {
      expect(state.listing).toBe('sold');
    }
  }

  beforeAll(async () => {
    // Fail closed. CI uses a disposable Docker container attested independently
    // via docker exec; local D3 retains its original fixed server identity.
    const ci = process.env.NEXUS_D5_CI_RUN === '1';
    const local = process.env.NEXUS_D3_RUN === '1';
    if (ci === local || !process.env.PGPASSWORD) {
      throw new Error('D3/D5 safety gate: exactly one test mode and password required');
    }
    const port = ci ? 55440 : 55439;
    const expectedId = ci
      ? process.env.NEXUS_D5_EXPECTED_SYSTEM_ID
      : '7709385096002039846';
    if (process.env.NEXUS_D3_HOST !== '127.0.0.1'
      || process.env.NEXUS_D3_PORT !== String(port)
      || process.env.NEXUS_D3_DB !== 'nexus_test'
      || process.env.NEXUS_D3_USER !== 'nexus_test'
      || (ci && process.env.NEXUS_D5_DISPOSABLE !== '1')
      || (ci && process.env.NEXUS_D3_EXPECTED_SYSTEM_ID)
      || (!ci && process.env.NEXUS_D3_EXPECTED_SYSTEM_ID !== expectedId)
      || !expectedId || !/^\d{15,25}$/.test(expectedId)) {
      throw new Error('D3/D5 safety gate: explicit disposable PostgreSQL settings required');
    }

    const connection = {
      type: 'postgres' as const,
      host: '127.0.0.1',
      port,
      username: 'nexus_test',
      database: 'nexus_test',
      password: process.env.PGPASSWORD,
      entities: [],
      synchronize: false,
      poolSize: 8,
      extra: { connectionTimeoutMillis: 5000, options: '-c lock_timeout=5000 -c statement_timeout=15000' },
    };
    root = await new DataSource(connection).initialize();
    const [identity] = (await root.query(
      `SELECT system_identifier::text AS id,
              current_database() AS db,
              current_user AS username
         FROM pg_control_system()`,
    )) as Array<{ id: string; db: string; username: string }>;
    if (identity?.id !== expectedId
      || identity.db !== 'nexus_test'
      || identity.username !== 'nexus_test') {
      throw new Error('D3 safety gate: PostgreSQL identity mismatch; no schema created');
    }

    await root.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    db = await new DataSource({
      ...connection,
      extra: {
        connectionTimeoutMillis: 5000,
        options: `-c search_path=${schema},public -c lock_timeout=5000 -c statement_timeout=15000`,
      },
    }).initialize();

    // Minimal faithful Marketplace tables and constraints. PostgreSQL's native
    // point/domain stands in for location::geometry, which detail() projects.
    await db.query(`
      CREATE DOMAIN geometry AS point;
      CREATE FUNCTION st_x(geometry) RETURNS double precision
        LANGUAGE sql IMMUTABLE AS 'SELECT ($1::point)[0]';
      CREATE FUNCTION st_y(geometry) RETURNS double precision
        LANGUAGE sql IMMUTABLE AS 'SELECT ($1::point)[1]';

      CREATE TABLE users (
        id uuid PRIMARY KEY, display_name text NOT NULL, avatar_url text
      );
      CREATE TABLE listings (
        id uuid PRIMARY KEY,
        seller_id uuid NOT NULL REFERENCES users(id),
        title text NOT NULL DEFAULT 'D3 test listing',
        description text, thumbnail_url text,
        price_cents integer NOT NULL DEFAULT 10000,
        currency char(3) NOT NULL DEFAULT 'USD',
        category text NOT NULL DEFAULT 'goods',
        status text NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','sold','withdrawn')),
        visibility text NOT NULL DEFAULT 'public',
        mode text NOT NULL DEFAULT 'sell',
        marketplace_kind text NOT NULL DEFAULT 'for_sale',
        location geometry NOT NULL DEFAULT point(23.3,42.7),
        expires_at timestamptz, bumped_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      );
      CREATE TABLE user_blocks (
        blocker_id uuid NOT NULL REFERENCES users(id),
        blocked_id uuid NOT NULL REFERENCES users(id),
        PRIMARY KEY(blocker_id, blocked_id)
      );
      CREATE TABLE trade_offers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id uuid NOT NULL REFERENCES listings(id),
        buyer_id uuid NOT NULL REFERENCES users(id),
        message text, offer_cents integer,
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','accepted','declined','withdrawn')),
        last_actor text CHECK (last_actor IN ('buyer','seller')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(listing_id,buyer_id)
      );
      CREATE TABLE trade_favorites (
        listing_id uuid NOT NULL REFERENCES listings(id),
        user_id uuid NOT NULL REFERENCES users(id),
        PRIMARY KEY(listing_id,user_id)
      );
    `);
    service = new ListingsService(db, {} as NotificationsService, {} as S3Service);
  }, 30_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (root?.isInitialized) {
      if (schemaCreated) await root.query(`DROP SCHEMA "${schema}" CASCADE`);
      await root.destroy();
    }
  }, 30_000);

  beforeEach(async () => {
    listingId = randomUUID();
    offerA = randomUUID();
    offerB = randomUUID();
    await db.query('TRUNCATE trade_favorites, trade_offers, user_blocks, listings, users CASCADE');
    await db.query(
      `INSERT INTO users (id,display_name) VALUES
        ($1,'Seller'),($2,'Buyer A'),($3,'Buyer B')`,
      [seller, buyerA, buyerB],
    );
    await db.query('INSERT INTO listings(id,seller_id) VALUES ($1,$2)', [listingId, seller]);
    await db.query(
      `INSERT INTO trade_offers(id,listing_id,buyer_id,offer_cents,last_actor)
        VALUES ($1,$3,$4,4000,'buyer'),($2,$3,$5,4500,'buyer')`,
      [offerA, offerB, listingId, buyerA, buyerB],
    );
  });

  it.each(['withdrawn', 'declined', 'accepted'] as const)(
    'makeOffer never reopens a %s offer on an active listing', async (terminalStatus) => {
      await db.query('UPDATE trade_offers SET status = $2 WHERE id = $1', [offerA, terminalStatus]);
      await expect(service.makeOffer(buyerA, listingId, { offerCents: 9900 }))
        .rejects.toBeInstanceOf(ConflictException);
      const state = await snapshot();
      const existing = state.offers.find((offer) => offer.id === offerA);
      expect(state.listing).toBe('active');
      expect(existing?.status).toBe(terminalStatus);
      expect(existing?.offer_cents).toBe(4000);
      expect(existing?.last_actor).toBe('buyer');
      expect(state.offers).toHaveLength(2);
    },
  );
  it('accept A vs accept B: exactly one accepted and listing sold', async () => {
    const results = await Promise.allSettled([
      service.respondToOffer(seller, offerA, 'accepted'),
      service.respondToOffer(seller, offerB, 'accepted'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const state = await snapshot();
    expect(state.listing).toBe('sold');
    expect(acceptedCount(state.offers)).toBe(1);
    expect(state.offers.filter((offer) => offer.status === 'declined')).toHaveLength(1);
    assertTerminalConsistency(state);
  });

  it('withdraw vs accept: terminal offer cannot be accepted after withdrawal', async () => {
    const results = await Promise.allSettled([
      service.withdrawOffer(buyerA, listingId),
      service.respondToOffer(seller, offerA, 'accepted'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const state = await snapshot();
    const chosen = state.offers.find((offer) => offer.id === offerA);
    expect(['accepted', 'withdrawn']).toContain(chosen?.status);
    if (chosen?.status === 'accepted') expect(state.listing).toBe('sold');
    if (chosen?.status === 'withdrawn') expect(state.listing).toBe('active');
    assertTerminalConsistency(state);
  });

  it('counter vs accept: no pending offer after successful acceptance', async () => {
    const results = await Promise.allSettled([
      service.counterOffer(seller, offerA, { offerCents: 5100 }),
      service.respondToOffer(seller, offerA, 'accepted'),
    ]);
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
    const state = await snapshot();
    expect(state.listing).toBe('sold');
    const chosen = state.offers.find((offer) => offer.id === offerA);
    expect(chosen?.status).toBe('accepted');
    if (results[0]?.status === 'fulfilled') {
      expect(chosen?.offer_cents).toBe(5100);
    } else {
      expect(chosen?.offer_cents).toBe(4000);
    }
    assertTerminalConsistency(state);
  });

  it('manual sold vs accept: exactly one state transition wins', async () => {
    const results = await Promise.allSettled([
      service.updateStatus(seller, listingId, 'sold'),
      service.respondToOffer(seller, offerA, 'accepted'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const state = await snapshot();
    expect(state.listing).toBe('sold');
    const chosen = state.offers.find((offer) => offer.id === offerA);
    expect(['accepted', 'declined']).toContain(chosen?.status);
    assertTerminalConsistency(state);
  });

  it('listing withdrawn vs makeOffer: no pending offers survive', async () => {
    const results = await Promise.allSettled([
      service.updateStatus(seller, listingId, 'withdrawn'),
      service.makeOffer(buyerB, listingId, { offerCents: 5700 }),
    ]);
    expect(results[0]?.status).toBe('fulfilled');
    const state = await snapshot();
    expect(state.listing).toBe('withdrawn');
    expect(state.offers.every((offer) => offer.status !== 'pending')).toBe(true);
    assertTerminalConsistency(state);
  });

  it('failure after offer UPDATE rolls back offer acceptance', async () => {
    await db.query(`
      CREATE FUNCTION d3_reject_sold() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.status = 'sold' THEN
          RAISE EXCEPTION 'D3 intentional rollback probe';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER d3_rollback_probe BEFORE UPDATE ON listings
      FOR EACH ROW EXECUTE FUNCTION d3_reject_sold();
    `);
    try {
      await expect(service.respondToOffer(seller, offerA, 'accepted')).rejects.toThrow();
      const state = await snapshot();
      expect(state.listing).toBe('active');
      expect(state.offers.find((offer) => offer.id === offerA)?.status).toBe('pending');
      expect(state.offers.find((offer) => offer.id === offerB)?.status).toBe('pending');
    } finally {
      await db.query('DROP TRIGGER IF EXISTS d3_rollback_probe ON listings');
      await db.query('DROP FUNCTION IF EXISTS d3_reject_sold()');
    }
  });
});
