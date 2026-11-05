/**
 * Opt-in, localhost-only, full-migration Discovery HTTP benchmark.
 * Needs a FRESH disposable PostGIS database whose 68 migrations were run
 * before Jest, and a dedicated ephemeral Redis DB 15 on loopback.
 * This is not the full AppModule nor a mobile-network performance gate.
 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as h3 from 'h3-js';
import Redis from 'ioredis';
import type { DiscoveryResponse, LoginResponse, Viewport } from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { AuthService } from '../auth/auth.service';
import { AuthController } from '../auth/auth.controller';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PasswordResetService } from '../auth/password-reset.service';
import { FriendsService } from '../friends/friends.service';
import { FriendsNotifyService } from '../friends/friends-notify.service';
import { BlocksService } from '../blocks/blocks.service';
import { PresenceService } from '../presence/presence.service';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { PlaceMapDiscoveryService } from './place-map-discovery.service';

const dbUrl = process.env.DATABASE_URL;
const redisUrl = process.env.DISCOVERY_FULL_HTTP_REDIS_URL;
function safeUrl(raw: string | undefined, scheme: string, suffix: string): boolean {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === scheme
      && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      && url.pathname.endsWith(suffix);
  } catch { return false; }
}
const enabled = process.env.DISCOVERY_FULL_SCHEMA_ACK_DISPOSABLE === 'YES'
  && process.env.DISCOVERY_FULL_HTTP_ACK_DISPOSABLE === 'YES'
  && safeUrl(dbUrl, 'postgresql:', '_bench')
  && safeUrl(redisUrl, 'redis:', '/15');
const suite = enabled ? describe : describe.skip;
const STAGES = [
  { entities: 10_000, users: 4_000, events: 3_000, listings: 3_000 },
  { entities: 50_000, users: 20_000, events: 15_000, listings: 15_000 },
  { entities: 100_000, users: 40_000, events: 30_000, listings: 30_000 },
] as const;
const INITIAL_USERS = STAGES[0].users;
const VIEWPORT: Viewport = {
  sw: { lat: 43.175, lng: 27.885 },
  ne: { lat: 43.235, lng: 27.945 },
};
const request = { viewport: VIEWPORT, zoom: 16, rankBy: 'relevance' as const };
const email = (n: number): string => 'nexa-bench-' + String(n) + '@invalid.example';
const pointIds = (response: DiscoveryResponse): string[] =>
  response.points.filter((point) => point.kind !== 'cluster')
    .map((point) => point.kind + ':' + point.id).sort();
function percentile(values: number[], fraction: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  return Number((ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] ?? 0).toFixed(2));
}

suite('NEXA full migrated PostGIS + JWT login + real Friends + Redis/HTTP', () => {
  jest.setTimeout(600_000);
  let db: DataSource | undefined;
  let redis: Redis | undefined;
  let app: INestApplication | undefined;
  const createdSnapshotKeys = new Set<string>();
  const oldSecret = process.env.JWT_SECRET;
  const oldTopK = process.env.DISCOVERY_SQL_TOPK;
  const oldThin = process.env.DISCOVERY_THIN_SQL_TOPK;
  const oldInline = process.env.DISCOVERY_THIN_INLINE_CANDIDATES;

  afterAll(async () => {
    if (app) await app.close();
    if (redis) {
      const keys = [...createdSnapshotKeys];
      // Presence keys and every request snapshot are registered during the test.
      if (keys.length > 0) await redis.del(...keys);
      redis.disconnect();
    }
    if (db?.isInitialized) await db.destroy();
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
    if (oldTopK === undefined) delete process.env.DISCOVERY_SQL_TOPK;
    else process.env.DISCOVERY_SQL_TOPK = oldTopK;
    if (oldThin === undefined) delete process.env.DISCOVERY_THIN_SQL_TOPK;
    else process.env.DISCOVERY_THIN_SQL_TOPK = oldThin;
    if (oldInline === undefined) delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
    else process.env.DISCOVERY_THIN_INLINE_CANDIDATES = oldInline;
  });

  it('profiles mixed entities at 10k/50k/100k under ten real JWT HTTP viewers and Redis presence', async () => {
    if (!dbUrl || !redisUrl) throw new Error('Disposable DB and Redis URLs required');
    process.env.JWT_SECRET = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    process.env.DISCOVERY_SQL_TOPK = '0';
    process.env.DISCOVERY_THIN_SQL_TOPK = '0';
    process.env.DISCOVERY_THIN_INLINE_CANDIDATES = '0';

    db = await new DataSource({ type: 'postgres', url: dbUrl, entities: [], poolSize: 10 }).initialize();
    redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3_000, maxRetriesPerRequest: 1 });
    await redis.connect();
    expect(await redis.ping()).toBe('PONG');

    // Abort rather than modifying an existing user-filled DB despite the
    // _bench URL gate. No DDL beyond a unique fixture positions table.
    const [startCount] = await db.query<Array<{ n: string }>>(
      'SELECT COUNT(*)::text AS n FROM users',
    );
    expect(startCount?.n).toBe('0');
    const [migrations] = await db.query<Array<{ n: string }>>(
      'SELECT COUNT(*)::text AS n FROM schema_migrations',
    );
    expect(Number(migrations?.n)).toBeGreaterThanOrEqual(68);

    const password = 'NexaSyntheticOnly-' + randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const positions = Array.from({ length: 625 }, (_, idx) => {
      const lat = 43.181 + Math.floor(idx / 25) * 0.0019;
      const lng = 27.890 + (idx % 25) * 0.002;
      return {
        idx, lat, lng,
        r4: h3.latLngToCell(lat, lng, 4),
        r5: h3.latLngToCell(lat, lng, 5),
        r6: h3.latLngToCell(lat, lng, 6),
        r7: h3.latLngToCell(lat, lng, 7),
        r8: h3.latLngToCell(lat, lng, 8),
        r9: h3.latLngToCell(lat, lng, 9),
        r10: h3.latLngToCell(lat, lng, 10),
      };
    });
    await db.query(`
      CREATE TABLE nexa_bench_positions (
        idx integer PRIMARY KEY, lat double precision, lng double precision,
        r4 text, r5 text, r6 text, r7 text, r8 text, r9 text, r10 text
      )`);
    await db.query(`
      INSERT INTO nexa_bench_positions
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS p(
        idx integer, lat double precision, lng double precision,
        r4 text, r5 text, r6 text, r7 text, r8 text, r9 text, r10 text
      )`, [JSON.stringify(positions)]);
    await db.query(`
      INSERT INTO users (
        id, email, password_hash, display_name, verification_level,
        visibility, location, location_h3_r4, location_h3_r5,
        location_h3_r6, location_h3_r7, location_h3_r8,
        location_h3_r9, location_h3_r10
      )
      SELECT md5('nexa-full-user-' || n::text)::uuid,
             'nexa-bench-' || n::text || '@invalid.example', $1,
             'Synthetic', 'phone', 'public',
             ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
             p.r4, p.r5, p.r6, p.r7, p.r8, p.r9, p.r10
        FROM generate_series(1, $2::integer) AS g(n)
        JOIN nexa_bench_positions p ON p.idx = (n - 1) % 625
    `, [passwordHash, INITIAL_USERS]);
    const subjects = await db.query<Array<{ id: string; email: string }>>(
      'SELECT id, email::text FROM users WHERE email::text = ANY($1::text[])',
      [Array.from({ length: 15 }, (_, i) => email(i + 1))],
    );
    expect(subjects).toHaveLength(15);
    const ids = new Map(subjects.map((subject) => [subject.email, subject.id]));
    const id = (n: number): string => {
      const value = ids.get(email(n));
      if (!value) throw new Error('Missing synthetic viewer');
      return value;
    };
    const viewers = Array.from({ length: 10 }, (_, i) => ({ id: id(i + 1), email: email(i + 1) }));
    const friend = id(11);
    const blockedByViewer = id(12);
    const blocksViewer = id(13);
    const privateId = id(14);
    const deletedId = id(15);
    await db.query(`
      INSERT INTO friendships (user_low_id, user_high_id)
      SELECT LEAST(v.id, $1::uuid), GREATEST(v.id, $1::uuid)
        FROM unnest($2::uuid[]) AS v(id)
    `, [friend, viewers.map((viewer) => viewer.id)]);
    await db.query(
      'INSERT INTO user_blocks(blocker_id,blocked_id) VALUES ($1,$2),($3,$4)',
      [id(1), blockedByViewer, blocksViewer, id(2)],
    );
    await db.query('UPDATE users SET visibility = $1 WHERE id = $2', ['private', privateId]);
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [deletedId]);
    await db.query('ANALYZE users');
    await redis.set('presence:user:' + friend, '1', 'EX', 120);
    await redis.set('presence:last_seen:' + friend, String(Date.now()), 'EX', 120);
    createdSnapshotKeys.add('presence:user:' + friend);
    createdSnapshotKeys.add('presence:last_seen:' + friend);

    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '15m' } }),
      ],
      controllers: [AuthController, DiscoveryController],
      providers: [
        { provide: getDataSourceToken(), useValue: db },
        { provide: REDIS_CLIENT, useValue: redis },
        JwtStrategy, AuthService, PresenceService, DiscoveryService,
        {
          provide: FriendsService,
          useFactory: (source: DataSource, presence: PresenceService): FriendsService =>
            new FriendsService(
              source,
              {} as BlocksService,
              presence,
              {} as FriendsNotifyService,
            ),
          inject: [getDataSourceToken(), PresenceService],
        },
        { provide: PasswordResetService, useValue: {} },
        { provide: PlaceMapDiscoveryService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({
      transform: true, whitelist: true, forbidNonWhitelisted: true,
    }));
    await app.listen(0, '127.0.0.1');
    const address = (app.getHttpServer() as { address(): AddressInfo | string | null }).address();
    if (!address || typeof address === 'string') throw new Error('Expected loopback HTTP port');
    const base = 'http://127.0.0.1:' + String(address.port) + '/api/v1';
    const post = (route: string, body: object, token?: string): Promise<Response> =>
      fetch(base + route, {
        method: 'POST', headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

    const unauthorized = await post('/discovery/nearby', request);
    expect(unauthorized.status).toBe(401);
    const tokens = new Map<string, string>();
    for (const viewer of viewers) {
      const response = await post('/auth/login', { email: viewer.email, password });
      expect(response.status).toBe(200);
      const result = await response.json() as LoginResponse;
      expect(result.user.id).toBe(viewer.id);
      expect(result.tokens.accessToken.length).toBeGreaterThan(40);
      tokens.set(viewer.id, result.tokens.accessToken);
    }

    const realFriends = moduleRef.get(FriendsService);
    expect(await realFriends.listFriendIds(viewers[0]!.id)).toContain(friend);
    expect((await realFriends.listWhoAllowFriendsOnline([friend])).has(friend)).toBe(true);
    const realPresence = moduleRef.get(PresenceService);
    expect((await realPresence.whichAreOnline([friend])).has(friend)).toBe(true);
    expect((await realPresence.lastSeenMap([friend])).has(friend)).toBe(true);


    // Preserve the production schema while growing synthetic content in three
    // stages. Owner IDs are deterministic and reference already seeded users.
    // The only new physical table is the disposable, benchmark-owned positions.
    const database = db;
    let seededUsers: number = INITIAL_USERS;
    let seededEvents = 0;
    let seededListings = 0;

    async function expandTo(stage: typeof STAGES[number]): Promise<void> {
      if (stage.users > seededUsers) {
        await database.query(`
          INSERT INTO users (
            id,email,password_hash,display_name,verification_level,
            visibility,location,location_h3_r4,location_h3_r5,
            location_h3_r6,location_h3_r7,location_h3_r8,
            location_h3_r9,location_h3_r10
          )
          SELECT md5('nexa-full-user-' || n::text)::uuid,
                 'nexa-bench-' || n::text || '@invalid.example',$1,
                 'Synthetic','phone','public',
                 ST_SetSRID(ST_MakePoint(p.lng,p.lat),4326)::geography,
                 p.r4,p.r5,p.r6,p.r7,p.r8,p.r9,p.r10
            FROM generate_series($2::integer,$3::integer) AS g(n)
            JOIN nexa_bench_positions p ON p.idx=(n-1)%625
        `, [passwordHash, seededUsers + 1, stage.users]);
        seededUsers = stage.users;
      }
      if (stage.events > seededEvents) {
        await database.query(`
          INSERT INTO events (
            id,host_id,title,starts_at,visibility,location,
            location_h3_r4,location_h3_r5,location_h3_r6,
            location_h3_r7,location_h3_r8,location_h3_r9,location_h3_r10
          )
          SELECT md5('nexa-full-event-' || n::text)::uuid,
                 md5('nexa-full-user-' || (1 + ((n - 1) % $3::integer))::text)::uuid,
                 'Synthetic event ' || n,
                 NOW() + interval '7 days',
                 CASE WHEN n%37=0 THEN 'private' ELSE 'public' END,
                 ST_SetSRID(ST_MakePoint(p.lng,p.lat),4326)::geography,
                 p.r4,p.r5,p.r6,p.r7,p.r8,p.r9,p.r10
            FROM generate_series($1::integer,$2::integer) AS g(n)
            JOIN nexa_bench_positions p ON p.idx=(n-1)%625
        `, [seededEvents + 1, stage.events, stage.users]);
        seededEvents = stage.events;
      }
      if (stage.listings > seededListings) {
        await database.query(`
          INSERT INTO listings (
            id,seller_id,title,price_cents,currency,category,
            status,mode,marketplace_kind,expires_at,visibility,location,
            location_h3_r4,location_h3_r5,location_h3_r6,
            location_h3_r7,location_h3_r8,location_h3_r9,location_h3_r10
          )
          SELECT md5('nexa-full-listing-' || n::text)::uuid,
                 md5('nexa-full-user-' || (1 + ((n - 1) % $3::integer))::text)::uuid,
                 'Synthetic listing ' || n,1000+n,'EUR','general',
                 'active','sell','for_sale',NOW()+interval '14 days',
                 CASE WHEN n%41=0 THEN 'private' ELSE 'public' END,
                 ST_SetSRID(ST_MakePoint(p.lng,p.lat),4326)::geography,
                 p.r4,p.r5,p.r6,p.r7,p.r8,p.r9,p.r10
            FROM generate_series($1::integer,$2::integer) AS g(n)
            JOIN nexa_bench_positions p ON p.idx=(n-1)%625
        `, [seededListings + 1, stage.listings, stage.users]);
        seededListings = stage.listings;
      }
      for (const relation of ['users', 'events', 'listings']) {
        await database.query('ANALYZE ' + relation);
      }
      const [counts] = await database.query<Array<{ n: string }>>(`
        SELECT ((SELECT COUNT(*) FROM users) +
                (SELECT COUNT(*) FROM events) +
                (SELECT COUNT(*) FROM listings))::text AS n
      `);
      expect(Number(counts?.n)).toBe(stage.entities);
    }

    const discovery = moduleRef.get(DiscoveryService);
    for (const stage of STAGES) {
      await expandTo(stage);
      process.env.DISCOVERY_SQL_TOPK = '0';
      process.env.DISCOVERY_THIN_SQL_TOPK = '0';
      process.env.DISCOVERY_THIN_INLINE_CANDIDATES = '0';
      const expected = new Map<string, string[]>();
      for (const viewer of viewers) {
        const baseline = await discovery.nearby({ ...request, requesterId: viewer.id });
        expected.set(viewer.id, pointIds(baseline));
        expect(baseline.points.length).toBe(500);
        createdSnapshotKeys.add('discovery:snap:' + viewer.id + ':' + baseline.viewportHash);
      }
      expect(expected.get(viewers[0]!.id)).not.toContain('user:' + blockedByViewer);
      expect(expected.get(viewers[1]!.id)).not.toContain('user:' + blocksViewer);

      // Opt-in shortlist only within the disposable test. Authoritative DB
      // hydration continues enforcing bilateral block and owner visibility.
      process.env.DISCOVERY_SQL_TOPK = '1';
      process.env.DISCOVERY_THIN_SQL_TOPK = '1';
      process.env.DISCOVERY_THIN_INLINE_CANDIDATES = '1';

      // Observe database sessions through a separate pool, avoiding the ten
      // request connections. This samples wait events, not CPU utilization;
      // no SQL text, IPs, identity or query parameters are collected.
      const observer = await new DataSource({
        type: 'postgres', url: dbUrl, entities: [], poolSize: 1,
      }).initialize();
      const sampledWaits = new Map<string, number>();
      let activePeak = 0;
      let sampleCount = 0;
      let stopSampling = false;
      const sampling = (async (): Promise<void> => {
        while (!stopSampling) {
          const rows = await observer.query<Array<{
            wait_event_type: string | null;
            wait_event: string | null;
          }>>(`
            SELECT wait_event_type,wait_event
              FROM pg_stat_activity
             WHERE datname=current_database()
               AND pid <> pg_backend_pid()
               AND state='active'
          `);
          sampleCount += 1;
          activePeak = Math.max(activePeak, rows.length);
          for (const row of rows) {
            const key = row.wait_event_type == null
              ? 'no_pg_wait_event' : row.wait_event_type + ':' + (row.wait_event ?? 'unknown');
            sampledWaits.set(key, (sampledWaits.get(key) ?? 0) + 1);
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 35));
        }
      })();

      const started = performance.now();
      let outcomes: PromiseSettledResult<{
        viewer: typeof viewers[number]; body: DiscoveryResponse; elapsedMs: number;
      }>[];
      try {
        outcomes = await Promise.allSettled(viewers.map(async (viewer) => {
          const begin = performance.now();
          const response = await post('/discovery/nearby', request, tokens.get(viewer.id));
          if (response.status !== 200) {
            throw new Error('Authenticated discovery HTTP status was not 200');
          }
          const body = await response.json() as DiscoveryResponse;
          // Include response body transfer/JSON parse, not headers alone.
          return { viewer, body, elapsedMs: performance.now() - begin };
        }));
      } finally {
        stopSampling = true;
        await sampling;
        await observer.destroy();
      }
      const wallMs = performance.now() - started;
      const durations: number[] = [];
      for (const outcome of outcomes) {
        if (outcome.status === 'rejected') throw outcome.reason;
        const { viewer, body, elapsedMs } = outcome.value;
        expect(pointIds(body)).toEqual(expected.get(viewer.id));
        expect(body.points.length).toBe(500);
        expect(pointIds(body)).not.toContain('user:' + privateId);
        expect(pointIds(body)).not.toContain('user:' + deletedId);
        const key = 'discovery:snap:' + viewer.id + ':' + body.viewportHash;
        createdSnapshotKeys.add(key);
        expect(await redis.get(key)).not.toBeNull();
        durations.push(elapsedMs);
      }

      console.info('DISCOVERY_FULL_SCHEMA_MIXED_HTTP_PROFILE', JSON.stringify({
        entities: stage.entities, kinds: ['user', 'event', 'listing'],
        sourceCounts: { users: stage.users, events: stage.events, listings: stage.listings },
        clients: viewers.length, jwtTokensFromAuthController: true,
        realFriendsService: true, realRedisPresence: true,
        httpP50Ms: percentile(durations, 0.5),
        httpP95Ms: percentile(durations, 0.95),
        batchWallMs: Number(wallMs.toFixed(2)),
        pgSampleCount: sampleCount, activeBackendPeak: activePeak,
        sampledPgWaitEvents: Object.fromEntries([...sampledWaits].sort()),
        parity: '10/10 viewer-specific top-500',
        exclusions: 'bidirectional blocks, private, deleted',
        limitations: 'isolated Nest module, not full AppModule or mobile network; one sample per size',
      }));
    }
  });
});
