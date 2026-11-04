/**
 * Opt-in realistic discovery VIEW benchmark.
 * This fixture executes the exact v_discoverable_entity CREATE VIEW from 0063,
 * backed by separate physical users/events/listings with owner joins and H3
 * indexes. The tables are projected/minimal, not a fully migrated schema.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { AddressInfo } from 'node:net';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as h3 from 'h3-js';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { cellsForViewport, type DiscoveryResponse, type Viewport } from '@g88/shared';

import { DiscoveryService } from './discovery.service';
import { FriendsService } from '../friends/friends.service';
import { PresenceService } from '../presence/presence.service';
import { DiscoveryController } from './discovery.controller';
import { PlaceMapDiscoveryService } from './place-map-discovery.service';
import { JwtStrategy } from '../auth/jwt.strategy';

const url = process.env.DISCOVERY_BENCH_DATABASE_URL;
const safe = (() => {
  try {
    const parsed = new URL(url ?? '');
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
      && parsed.pathname.endsWith('_bench');
  } catch {
    return false;
  }
})();
const enabled = safe && process.env.DISCOVERY_BENCH_ACK_DISPOSABLE === 'YES';
const suite = enabled ? describe : describe.skip;
// Real Redis is optional but must be a disposable, loopback-only Redis DB 15.
const httpRedisUrl = process.env.DISCOVERY_BENCH_REDIS_URL;
const httpRedisSafe = (() => {
  try {
    const parsed = new URL(httpRedisUrl ?? '');
    return parsed.protocol === 'redis:'
      && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
      && parsed.pathname === '/15'
      && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
})();
const httpTest = enabled && httpRedisSafe && process.env.DISCOVERY_BENCH_ACK_REDIS === 'YES'
  ? it : it.skip;
const VIEWER = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const VIEWPORT: Viewport = {
  sw: { lat: 43.175, lng: 27.885 },
  ne: { lat: 43.235, lng: 27.945 },
};
const SIZES = process.env.DISCOVERY_BENCH_QUICK === 'YES'
  ? [10_000] as const
  : [10_000, 50_000, 100_000] as const;
const RUNS = 5;

interface TimedQuery { sql: string; params: unknown[]; elapsedMs: number; rows: number }
interface ExplainPlan {
  'Node Type'?: string;
  'Index Name'?: string;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Temp Read Blocks'?: number;
  'Temp Written Blocks'?: number;
  Plans?: ExplainPlan[];
}
interface ExplainRecord {
  Plan: ExplainPlan;
  'Execution Time': number;
  'Planning Time': number;
}
interface ExplainRow {
  'QUERY PLAN': ExplainRecord[] | string;
}
interface Position {
  idx: number; lat: number; lng: number;
  r4: string; r5: string; r6: string; r7: string;
  r8: string; r9: string; r10: string;
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
}
function planDetails(root: ExplainPlan): { nodes: string[]; indexes: string[] } {
  const nodes: string[] = [];
  const indexes: string[] = [];
  const visit = (p: ExplainPlan): void => {
    nodes.push(p['Node Type'] ?? '?');
    if (p['Index Name']) indexes.push(p['Index Name']);
    for (const child of p.Plans ?? []) visit(child);
  };
  visit(root);
  return { nodes, indexes };
}

suite('Discovery on actual 0063 user/event/listing UNION view', () => {
  let admin: DataSource;
  let db: DataSource;
  let service: DiscoveryService;
  let lastSize = 0;
  let queries: TimedQuery[] = [];
  const schema = 'discovery_union_' + randomUUID().replaceAll('-', '');

  beforeAll(async () => {
    admin = await new DataSource({ type: 'postgres', url, entities: [] }).initialize();
    await admin.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    db = await new DataSource({
      type: 'postgres', url, entities: [],
      extra: { options: `-c search_path=${schema},public` },
    }).initialize();

    const h3Columns = [4,5,6,7,8,9,10]
      .map((r) => `location_h3_r${r} text`).join(', ');
    await db.query(`
      CREATE TABLE positions (
        idx integer PRIMARY KEY, lat double precision, lng double precision,
        r4 text,r5 text,r6 text,r7 text,r8 text,r9 text,r10 text
      );
      CREATE TABLE users (
        id uuid PRIMARY KEY, display_name text NOT NULL, avatar_url text,
        verification_level text NOT NULL, id_verification_status text,
        visibility text NOT NULL, location geography(Point,4326),
        ${h3Columns}, deleted_at timestamptz
      );
      CREATE TABLE events (
        id uuid PRIMARY KEY, host_id uuid REFERENCES users(id),
        title text NOT NULL, cover_url text, starts_at timestamptz NOT NULL,
        attendee_count integer NOT NULL, capacity integer,
        visibility text NOT NULL, location geography(Point,4326),
        ${h3Columns}, deleted_at timestamptz
      );
      CREATE TABLE listings (
        id uuid PRIMARY KEY, seller_id uuid REFERENCES users(id),
        title text NOT NULL, thumbnail_url text,
        price_cents integer NOT NULL, currency text NOT NULL, category text NOT NULL,
        mode text NOT NULL, marketplace_kind text NOT NULL,
        status text NOT NULL, visibility text NOT NULL,
        created_at timestamptz NOT NULL, expires_at timestamptz,
        bumped_at timestamptz, location geography(Point,4326),
        ${h3Columns}, deleted_at timestamptz
      );
      CREATE TABLE user_blocks (blocker_id uuid NOT NULL, blocked_id uuid NOT NULL);
      CREATE INDEX union_block_forward ON user_blocks(blocker_id,blocked_id);
      CREATE INDEX union_block_reverse ON user_blocks(blocked_id,blocker_id);
    `);
    for (const table of ['users', 'events', 'listings']) {
      for (const resolution of [7,8,9,10]) {
        await db.query(`CREATE INDEX ${table}_h3_r${resolution}
          ON ${table}(location_h3_r${resolution})`);
      }
      await db.query(`CREATE INDEX ${table}_geom_gist ON ${table} USING GIST(location)`);
    }

    const positions: Position[] = [];
    for (let y=0;y<25;y+=1) for (let x=0;x<25;x+=1) {
      const lat=43.205+(y-12)*0.0016;
      const lng=27.915+(x-12)*0.0016;
      positions.push({
        idx:y*25+x,lat,lng,
        r4:h3.latLngToCell(lat,lng,4),r5:h3.latLngToCell(lat,lng,5),
        r6:h3.latLngToCell(lat,lng,6),r7:h3.latLngToCell(lat,lng,7),
        r8:h3.latLngToCell(lat,lng,8),r9:h3.latLngToCell(lat,lng,9),
        r10:h3.latLngToCell(lat,lng,10),
      });
    }
    await db.query(`
      INSERT INTO positions(idx,lat,lng,r4,r5,r6,r7,r8,r9,r10)
      SELECT idx,lat,lng,r4,r5,r6,r7,r8,r9,r10
      FROM jsonb_to_recordset($1::jsonb) AS p(
        idx integer,lat double precision,lng double precision,
        r4 text,r5 text,r6 text,r7 text,r8 text,r9 text,r10 text)
    `,[JSON.stringify(positions)]);

    // Crucially load the view definition from the repository migration, not
    // a hand-maintained approximation of the production projection.
    const migration = readFileSync(
      join(__dirname, '../../../migrations/0063_marketplace_kind.sql'), 'utf8');
    const marker = 'CREATE OR REPLACE VIEW v_discoverable_entity AS';
    const at = migration.lastIndexOf(marker);
    if (at < 0) throw new Error('Migration 0063 has no discovery view');
    await db.query(migration.slice(at));
    // Topic parity must exercise the actual production slug function, too.
    const slugifyMigration = readFileSync(
      join(__dirname, '../../../migrations/0023_slugify.sql'), 'utf8');
    await db.query(slugifyMigration);

    await db.query(`
      INSERT INTO user_blocks(blocker_id,blocked_id) VALUES
      ($1::uuid,md5('usr-5')::uuid),
      (md5('usr-9')::uuid,$1::uuid)
    `,[VIEWER]);

    const instrumented = {
      query: async <T>(sql: string,params: unknown[]=[]): Promise<T> => {
        const t=performance.now();
        const result=await db.query<T>(sql,params);
        queries.push({sql,params:[...params],elapsedMs:performance.now()-t,
          rows:Array.isArray(result)?result.length:0});
        return result;
      },
    } as unknown as DataSource;
    const friends = {
      listFriendIds: async (): Promise<string[]> => [],
      listWhoAllowFriendsOnline: async (): Promise<Set<string>> => new Set<string>(),
    } as unknown as FriendsService;
    const presence = {
      whichAreOnline: async (): Promise<Set<string>> => new Set<string>(),
      lastSeenMap: async (): Promise<Map<string,string>> => new Map<string,string>(),
    } as unknown as PresenceService;
    const redis = {
      get: async (): Promise<null> => null,
      set: async (): Promise<'OK'> => 'OK',
    } as unknown as Redis;
    service=new DiscoveryService(instrumented,presence,friends,redis);
  },90_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.destroy();
    }
  },30_000);

  async function seed(total: number): Promise<void> {
    const prevUsers=Math.floor(lastSize*0.4);
    const prevEvents=Math.floor(lastSize*0.3);
    const targetUsers=Math.floor(total*0.4);
    const targetEvents=Math.floor(total*0.3);
    const targetListings=total-targetUsers-targetEvents;
    const prevListings=lastSize-prevUsers-prevEvents;
    const h3names=[4,5,6,7,8,9,10]
      .map((r)=>'location_h3_r'+r).join(',');
    const h3select=[4,5,6,7,8,9,10].map((r)=>'p.r'+r).join(',');
    const geo='ST_SetSRID(ST_MakePoint(p.lng,p.lat),4326)::geography';

    await db.query(`
      INSERT INTO users(id,display_name,avatar_url,verification_level,
        id_verification_status,visibility,location,${h3names},deleted_at)
      SELECT md5('usr-'||n::text)::uuid,'User '||n,NULL,
        CASE WHEN n%9=0 THEN 'id' ELSE 'phone' END,
        CASE WHEN n%9=0 THEN 'verified' ELSE 'pending' END,
        CASE WHEN n%37=0 THEN 'private' ELSE 'public' END,
        ${geo},${h3select},
        CASE WHEN n%113=0 THEN NOW() ELSE NULL END
      FROM generate_series($1::integer,$2::integer) AS g(n)
      JOIN positions p ON p.idx = (n-1)%625
    `,[prevUsers+1,targetUsers]);

    await db.query(`
      INSERT INTO events(id,host_id,title,cover_url,starts_at,
        attendee_count,capacity,visibility,location,${h3names},deleted_at)
      SELECT md5('evt-'||n::text)::uuid,
        md5('usr-'||(1+n%4000)::text)::uuid,
        'Event '||n,NULL,
        NOW()+ ((1+n%72)||' hours')::interval, n%100,NULL,
        CASE WHEN n%37=0 THEN 'private' ELSE 'public' END,
        ${geo},${h3select},
        CASE WHEN n%173=0 THEN NOW() ELSE NULL END
      FROM generate_series($1::integer,$2::integer) AS g(n)
      JOIN positions p ON p.idx = (n-1)%625
    `,[prevEvents+1,targetEvents]);

    await db.query(`
      INSERT INTO listings(id,seller_id,title,thumbnail_url,price_cents,
        currency,category,mode,marketplace_kind,status,visibility,
        created_at,expires_at,bumped_at,location,${h3names},deleted_at)
      SELECT md5('lst-'||n::text)::uuid,
        md5('usr-'||(1+n%4000)::text)::uuid,
        'Listing '||n,NULL,1000+n,'EUR','general','sell',
        'for_sale',
        CASE WHEN n%103=0 THEN 'sold' ELSE 'active' END,
        CASE WHEN n%37=0 THEN 'private' ELSE 'public' END,
        NOW()-((n%240)||' minutes')::interval,NOW()+interval '14 days',
        NULL,${geo},${h3select},
        CASE WHEN n%151=0 THEN NOW() ELSE NULL END
      FROM generate_series($1::integer,$2::integer) AS g(n)
      JOIN positions p ON p.idx = (n-1)%625
    `,[prevListings+1,targetListings]);
    lastSize=total;
    for (const table of ['users','events','listings','user_blocks']) {
      await db.query('ANALYZE '+table);
    }
  }

  async function explain(query: TimedQuery): Promise<unknown> {
    const result=await db.query<ExplainRow[]>(
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+query.sql,query.params);
    const raw=result[0]?.['QUERY PLAN'];
    const items=typeof raw==='string'
      ? JSON.parse(raw) as ExplainRecord[] : raw;
    const first=items?.[0];
    if (!first) throw new Error('Missing PostgreSQL EXPLAIN plan');
    return {
      planningMs:first['Planning Time'],
      executionMs:first['Execution Time'],
      // Root plan includes its children; do not sum buffer counts per node.
      sharedHitBlocks:first.Plan['Shared Hit Blocks'] ?? 0,
      sharedReadBlocks:first.Plan['Shared Read Blocks'] ?? 0,
      tempReadBlocks:first.Plan['Temp Read Blocks'] ?? 0,
      tempWrittenBlocks:first.Plan['Temp Written Blocks'] ?? 0,
      ...planDetails(first.Plan),
    };
  }

  for (const size of SIZES) {
    it('benchmarks actual migrated UNION view at '+size+' rows',async () => {
      await seed(size);
      const [totals]=await db.query<Array<{total:string}>>(`
        SELECT (
          (SELECT COUNT(*) FROM users) +
          (SELECT COUNT(*) FROM events) +
          (SELECT COUNT(*) FROM listings)
        )::text AS total
      `);
      expect(Number(totals?.total)).toBe(size);
      let oldKeys: string[]=[];
      const previous=process.env.DISCOVERY_SQL_TOPK;
      const previousThin=process.env.DISCOVERY_THIN_SQL_TOPK;
      const previousInline=process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      try {
        for (const variant of ['js','sql','thin','inline'] as const) {
          process.env.DISCOVERY_SQL_TOPK=variant==='js'?'0':'1';
          process.env.DISCOVERY_THIN_SQL_TOPK=variant==='thin'||variant==='inline'?'1':'0';
          process.env.DISCOVERY_THIN_INLINE_CANDIDATES=variant==='inline'?'1':'0';
          const elapsed: number[]=[];
          let representative: TimedQuery[]=[];
          for (let run=0;run<=RUNS;run+=1) {
            queries=[];
            const started=performance.now();
            const response=await service.nearby({
              viewport:VIEWPORT,zoom:16,requesterId:VIEWER,rankBy:'relevance',
            });
            const duration=performance.now()-started;
            const keys=response.points
              .filter((point)=>point.kind!=='cluster')
              .map((point)=>point.kind+':'+point.id).sort();
            expect(keys).toHaveLength(500);
            if (run===1) {
              if (variant==='js') oldKeys=keys;
              else expect(keys).toEqual(oldKeys);
              representative=[...queries];
            }
            if (run>0) elapsed.push(duration);
          }
          const plans=[];
          for (const call of representative.filter((q)=>
            q.sql.includes('FROM v_discoverable_entity') ||
            q.sql.includes('WITH candidates AS MATERIALIZED'))) {
            plans.push({rows:call.rows,queryMs:Number(call.elapsedMs.toFixed(2)),
              explain:await explain(call)});
          }
          console.info('DISCOVERY_UNION_BENCH',JSON.stringify({
            size,variant,samples:RUNS,p95Ms:Number(p95(elapsed).toFixed(2)),
            plans,source:'exact 0063 view; minimal physical tables',
          }));
        }
      } finally {
        if (previous===undefined) delete process.env.DISCOVERY_SQL_TOPK;
        else process.env.DISCOVERY_SQL_TOPK=previous;
        if (previousThin===undefined) delete process.env.DISCOVERY_THIN_SQL_TOPK;
        else process.env.DISCOVERY_THIN_SQL_TOPK=previousThin;
        if (previousInline===undefined) delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
        else process.env.DISCOVERY_THIN_INLINE_CANDIDATES=previousInline;
      }

      // Map cluster count must represent ONLY rows allowed for this viewer:
      // the source view includes public/private/deleted owners and statuses.
      const clusters=await service.nearby({
        viewport:VIEWPORT,zoom:13,requesterId:VIEWER,
      });
      const resultCount=clusters.points.reduce((sum,point)=>
        point.kind==='cluster'?sum+point.count:sum,0);
      const cells=cellsForViewport(VIEWPORT,8);
      const [eligible]=await db.query<Array<{n:string}>>(`
        SELECT COUNT(*)::text AS n
          FROM v_discoverable_entity v
         WHERE v.location_h3_r8 = ANY($1::text[])
           AND v.visibility='public' AND v.id <> $2::uuid
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
              WHERE
               (ub.blocker_id=$2::uuid AND ub.blocked_id=CASE v.kind
                 WHEN 'user' THEN v.id
                 WHEN 'event' THEN NULLIF(v.meta->>'hostId','')::uuid
                 WHEN 'listing' THEN NULLIF(v.meta->>'sellerId','')::uuid END)
               OR
               (ub.blocked_id=$2::uuid AND ub.blocker_id=CASE v.kind
                 WHEN 'user' THEN v.id
                 WHEN 'event' THEN NULLIF(v.meta->>'hostId','')::uuid
                 WHEN 'listing' THEN NULLIF(v.meta->>'sellerId','')::uuid END)
           )
      `,[cells,VIEWER]);
      expect(resultCount).toBe(Number(eligible?.n));
      expect(clusters.points.length).toBeLessThanOrEqual(500);
      console.info('DISCOVERY_UNION_AUTHORIZED',JSON.stringify({
        size,count:resultCount,clusters:clusters.points.length,
      }));
    },900_000);
  }

  it('keeps source-kind, marketplace and buy/sell filters identical in JS, SQL and thin paths', async () => {
    const previous = process.env.DISCOVERY_SQL_TOPK;
    const previousThin = process.env.DISCOVERY_THIN_SQL_TOPK;
    const previousInline = process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
    const scenarios = [
      { kinds: ['user'] as const },
      { kinds: ['event'] as const },
      { kinds: ['listing'] as const, listingMode: 'sell' as const, marketplaceKind: 'for_sale' as const },
      { kinds: ['listing'] as const, listingMode: 'buy' as const },
      { kinds: ['listing'] as const, marketplaceKind: 'service' as const },
    ];
    try {
      for (const scenario of scenarios) {
        let expected: string[] = [];
        for (const variant of ['js', 'sql', 'thin', 'inline'] as const) {
          process.env.DISCOVERY_SQL_TOPK = variant === 'js' ? '0' : '1';
          process.env.DISCOVERY_THIN_SQL_TOPK = variant === 'thin' || variant === 'inline' ? '1' : '0';
          process.env.DISCOVERY_THIN_INLINE_CANDIDATES = variant === 'inline' ? '1' : '0';
          const response = await service.nearby({
            viewport: VIEWPORT,
            zoom: 16,
            requesterId: VIEWER,
            rankBy: 'relevance',
            ...scenario,
            kinds: [...scenario.kinds],
          });
          const keys = response.points
            .filter((point) => point.kind !== 'cluster')
            .map((point) => point.kind + ':' + point.id)
            .sort();
          expect(keys.length).toBeLessThanOrEqual(500);
          if (variant === 'js') expected = keys;
          else expect(keys).toEqual(expected);
        }
      }
    } finally {
      if (previous === undefined) delete process.env.DISCOVERY_SQL_TOPK;
      else process.env.DISCOVERY_SQL_TOPK = previous;
      if (previousThin === undefined) delete process.env.DISCOVERY_THIN_SQL_TOPK;
      else process.env.DISCOVERY_THIN_SQL_TOPK = previousThin;
      if (previousInline === undefined) delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      else process.env.DISCOVERY_THIN_INLINE_CANDIDATES = previousInline;
    }
  }, 90_000);


  it('preserves topic matches and blocks in both directions through JS, SQL and thin shortlist', async () => {
    const previous = process.env.DISCOVERY_SQL_TOPK;
    const previousThin = process.env.DISCOVERY_THIN_SQL_TOPK;
    const previousInline = process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
    const [event] = await db.query<Array<{ id: string; host_id: string }>>(
      "SELECT id, host_id FROM events WHERE title = 'Event 42' LIMIT 1",
    );
    expect(event?.id).toBeTruthy();
    const candidate = event!;
    const eventQuery = {
      viewport: VIEWPORT,
      zoom: 16,
      requesterId: VIEWER,
      rankBy: 'relevance' as const,
      topic: '#event-42',
    };
    const check = async (expected: string[]): Promise<void> => {
      for (const variant of ['js', 'sql', 'thin', 'inline'] as const) {
        process.env.DISCOVERY_SQL_TOPK = variant === 'js' ? '0' : '1';
        process.env.DISCOVERY_THIN_SQL_TOPK = variant === 'thin' || variant === 'inline' ? '1' : '0';
          process.env.DISCOVERY_THIN_INLINE_CANDIDATES = variant === 'inline' ? '1' : '0';
        const result = await service.nearby(eventQuery);
        const keys = result.points
          .filter((p) => p.kind !== 'cluster')
          .map((p) => p.kind + ':' + p.id).sort();
        expect(keys).toEqual(expected);
      }
    };
    try {
      await check(['event:' + candidate.id]);
      const ownerDirections: Array<[string, string]> = [
        [VIEWER, candidate.host_id],
        [candidate.host_id, VIEWER],
      ];
      for (const [blocker, blocked] of ownerDirections) {
        await db.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES ($1,$2)',
          [blocker,blocked]);
        try {
          await check([]);
        } finally {
          await db.query('DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2',
            [blocker,blocked]);
        }
      }
      await db.query("UPDATE events SET visibility='private' WHERE id=$1", [candidate.id]);
      await check([]);
      await db.query("UPDATE events SET visibility='public', deleted_at=NOW() WHERE id=$1",
        [candidate.id]);
      await check([]);
      await db.query('UPDATE events SET deleted_at=NULL WHERE id=$1', [candidate.id]);
      await check(['event:' + candidate.id]);
      // Also verify listing-category topic binds for a broad, 500-capped result.
      let expectedListingKeys: string[] = [];
      for (const variant of ['js', 'sql', 'thin', 'inline'] as const) {
        process.env.DISCOVERY_SQL_TOPK = variant === 'js' ? '0' : '1';
        process.env.DISCOVERY_THIN_SQL_TOPK = variant === 'thin' || variant === 'inline' ? '1' : '0';
          process.env.DISCOVERY_THIN_INLINE_CANDIDATES = variant === 'inline' ? '1' : '0';
        const result = await service.nearby({
          viewport: VIEWPORT, zoom: 16, requesterId: VIEWER,
          rankBy: 'relevance', topic: '#general',
          kinds: ['listing'], listingMode: 'sell', marketplaceKind: 'for_sale',
        });
        const keys = result.points.filter((p) => p.kind !== 'cluster')
          .map((p) => p.kind + ':' + p.id).sort();
        expect(keys).toHaveLength(500);
        if (variant === 'js') expectedListingKeys = keys;
        else expect(keys).toEqual(expectedListingKeys);
      }
    } finally {
      await db.query("UPDATE events SET visibility='public', deleted_at=NULL WHERE id=$1",
        [candidate.id]);
      if (previous === undefined) delete process.env.DISCOVERY_SQL_TOPK;
      else process.env.DISCOVERY_SQL_TOPK = previous;
      if (previousThin === undefined) delete process.env.DISCOVERY_THIN_SQL_TOPK;
      else process.env.DISCOVERY_THIN_SQL_TOPK = previousThin;
      if (previousInline === undefined) delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      else process.env.DISCOVERY_THIN_INLINE_CANDIDATES = previousInline;
    }
  }, 180_000);

  it('compares ten concurrent thin and inline CTE requests against JS reference sets', async () => {
    const previous = process.env.DISCOVERY_SQL_TOPK;
    const previousThin = process.env.DISCOVERY_THIN_SQL_TOPK;
    const previousInline = process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
    // Include the original blocked viewer plus nine distinct synthetic viewers.
    // These are service-level requests, not ten authenticated HTTP clients.
    const viewers = [VIEWER, ...Array.from({ length: 9 }, (_, i) =>
      '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'))];
    const request = (requesterId: string) => ({
      viewport: VIEWPORT,
      zoom: 16,
      requesterId,
      rankBy: 'relevance' as const,
    });
    const ids = (result: Awaited<ReturnType<typeof service.nearby>>): string[] =>
      result.points.filter((p) => p.kind !== 'cluster')
        .map((p) => p.kind + ':' + p.id).sort();
    try {
      process.env.DISCOVERY_SQL_TOPK = '0';
      process.env.DISCOVERY_THIN_SQL_TOPK = '0';
      // Sequential references limit JS memory pressure on shared CI workers.
      const expected = new Map<string, string[]>();
      for (const viewer of viewers) {
        const baseline = await service.nearby(request(viewer));
        expected.set(viewer, ids(baseline));
      }
      for (const mode of ['thin', 'inline'] as const) {
        process.env.DISCOVERY_SQL_TOPK = '1';
        process.env.DISCOVERY_THIN_SQL_TOPK = '1';
        process.env.DISCOVERY_THIN_INLINE_CANDIDATES = mode === 'inline' ? '1' : '0';
        const batchStarted = performance.now();
        const completed = await Promise.allSettled(viewers.map(async (viewer) => {
          const started = performance.now();
          const response = await service.nearby(request(viewer));
          return { viewer, keys: ids(response), elapsedMs: performance.now() - started };
        }));
        const samples: number[] = [];
        for (const result of completed) {
          if (result.status === 'rejected') throw result.reason;
          const { viewer, keys, elapsedMs } = result.value;
          expect(keys).toHaveLength(500);
          expect(keys).toEqual(expected.get(viewer));
          samples.push(elapsedMs);
        }
        const wallMs = performance.now() - batchStarted;
        const sorted = [...samples].sort((a,b) => a-b);
        console.info('DISCOVERY_UNION_CONCURRENT', JSON.stringify({
          datasetSize: lastSize, mode, concurrentSyntheticViewers: viewers.length,
          sampleCount: samples.length, p50Ms: Number((sorted[4] ?? 0).toFixed(2)),
          p95Ms: Number(p95(samples).toFixed(2)), wallMs: Number(wallMs.toFixed(2)),
          scope: 'PostGIS and DiscoveryService only, mock Friends/Presence/Redis, no HTTP',
        }));
      }
    } finally {
      if (previous === undefined) delete process.env.DISCOVERY_SQL_TOPK;
      else process.env.DISCOVERY_SQL_TOPK = previous;
      if (previousThin === undefined) delete process.env.DISCOVERY_THIN_SQL_TOPK;
      else process.env.DISCOVERY_THIN_SQL_TOPK = previousThin;
      if (previousInline === undefined) delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      else process.env.DISCOVERY_THIN_INLINE_CANDIDATES = previousInline;
    }
  }, 240_000);


  it('profiles connection acquisition versus SQL time under 2/5/10 connection pools', async () => {
    // Pure service/Postgres contention experiment. Never use a real user or a
    // production database, and never log SQL text, bound values or identities.
    const oldTopK = process.env.DISCOVERY_SQL_TOPK;
    const oldThin = process.env.DISCOVERY_THIN_SQL_TOPK;
    const oldInline = process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
    const viewers = [VIEWER, ...Array.from({ length: 9 }, (_, i) =>
      '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'))];
    const request = (requesterId: string) => ({
      viewport: VIEWPORT, zoom: 16, requesterId, rankBy: 'relevance' as const,
    });
    const keys = (response: Awaited<ReturnType<typeof service.nearby>>): string[] =>
      response.points.filter((point) => point.kind !== 'cluster')
        .map((point) => point.kind + ':' + point.id).sort();
    type SqlPhase = 'ranking' | 'hydration' | 'other';
    interface PoolSample {
      phase: SqlPhase;
      acquireMs: number;
      executeMs: number;
    }
    const summary = (values: number[]): {
      count: number; p50Ms: number; p95Ms: number; maxMs: number;
    } => {
      const sorted = [...values].sort((a, b) => a - b);
      const nth = (fraction: number): number =>
        sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
      return {
        count: values.length,
        p50Ms: Number(nth(0.5).toFixed(2)),
        p95Ms: Number(nth(0.95).toFixed(2)),
        maxMs: Number((sorted.at(-1) ?? 0).toFixed(2)),
      };
    };
    try {
      process.env.DISCOVERY_SQL_TOPK = '0';
      process.env.DISCOVERY_THIN_SQL_TOPK = '0';
      delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      // Each request is authorized against a per-viewer JS reference, not
      // merely checked for a 500-item result count.
      const reference = new Map<string, string[]>();
      for (const viewer of viewers) {
        reference.set(viewer, keys(await service.nearby(request(viewer))));
      }
      process.env.DISCOVERY_SQL_TOPK = '1';
      process.env.DISCOVERY_THIN_SQL_TOPK = '1';
      process.env.DISCOVERY_THIN_INLINE_CANDIDATES = '1';

      for (const poolSize of [2, 5, 10] as const) {
        const source = await new DataSource({
          type: 'postgres', url, entities: [], poolSize,
          extra: { options: `-c search_path=${schema},public` },
        }).initialize();
        const samples: PoolSample[] = [];
        // QueryRunner.connect() measures the wait to acquire a pg pool client.
        // QueryRunner.query() then measures the SQL/driver portion separately.
        const measured = {
          query: async <T>(sql: string, params: unknown[] = []): Promise<T> => {
            const runner = source.createQueryRunner();
            const started = performance.now();
            let acquired = started;
            try {
              await runner.connect();
              acquired = performance.now();
              const result = await runner.query(sql, params) as T;
              const finished = performance.now();
              const phase: SqlPhase = sql.includes('WITH candidates AS')
                ? 'ranking'
                : sql.includes('FROM v_discoverable_entity')
                  ? 'hydration'
                  : 'other';
              samples.push({
                phase,
                acquireMs: acquired - started,
                executeMs: finished - acquired,
              });
              return result;
            } finally {
              await runner.release();
            }
          },
        } as unknown as DataSource;
        const friends = {
          listFriendIds: async (): Promise<string[]> => [],
          listWhoAllowFriendsOnline: async (): Promise<Set<string>> => new Set<string>(),
        } as unknown as FriendsService;
        const presence = {
          whichAreOnline: async (): Promise<Set<string>> => new Set<string>(),
          lastSeenMap: async (): Promise<Map<string, string>> => new Map<string, string>(),
        } as unknown as PresenceService;
        const redis = {
          get: async (): Promise<null> => null,
          set: async (): Promise<'OK'> => 'OK',
        } as unknown as Redis;
        const profiled = new DiscoveryService(measured, presence, friends, redis);

        try {
          // Warm the query path and connection pool; exclude warmup probes.
          expect(keys(await profiled.nearby(request(VIEWER)))).toEqual(reference.get(VIEWER));
          samples.length = 0;
          const started = performance.now();
          const settled = await Promise.allSettled(viewers.map(async (viewer) => {
            const t = performance.now();
            const response = await profiled.nearby(request(viewer));
            return { viewer, durationMs: performance.now() - t, keys: keys(response) };
          }));
          const wallMs = performance.now() - started;
          const durations: number[] = [];
          for (const entry of settled) {
            if (entry.status === 'rejected') throw entry.reason;
            expect(entry.value.keys).toHaveLength(500);
            expect(entry.value.keys).toEqual(reference.get(entry.value.viewer));
            durations.push(entry.value.durationMs);
          }
          expect(samples.length).toBeGreaterThanOrEqual(viewers.length * 2);
          const phases: SqlPhase[] = ['ranking', 'hydration', 'other'];
          const byPhase = Object.fromEntries(phases.map((phase) => {
            const phaseSamples = samples.filter((item) => item.phase === phase);
            return [phase, {
              acquire: summary(phaseSamples.map((item) => item.acquireMs)),
              execute: summary(phaseSamples.map((item) => item.executeMs)),
            }];
          }));
          console.info('DISCOVERY_POOL_PROFILE', JSON.stringify({
            datasetSize: lastSize, concurrency: viewers.length, poolSize,
            request: summary(durations),
            wallMs: Number(wallMs.toFixed(2)),
            allAcquire: summary(samples.map((item) => item.acquireMs)),
            allExecute: summary(samples.map((item) => item.executeMs)),
            byPhase,
            source: 'QueryRunner.connect vs query; synthetic DB; mocked Redis/Friends/Presence; no HTTP',
          }));
        } finally {
          await source.destroy();
        }
      }
    } finally {
      if (oldTopK === undefined) delete process.env.DISCOVERY_SQL_TOPK;
      else process.env.DISCOVERY_SQL_TOPK = oldTopK;
      if (oldThin === undefined) delete process.env.DISCOVERY_THIN_SQL_TOPK;
      else process.env.DISCOVERY_THIN_SQL_TOPK = oldThin;
      if (oldInline === undefined) delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      else process.env.DISCOVERY_THIN_INLINE_CANDIDATES = oldInline;
    }
  }, 300_000);


  it('A/B profiles ranking-only FIFO scheduling under 10 viewers and a fixed pool of 10', async () => {
    // A diagnostic ONLY: this test does not install a limiter in the running app.
    // The final hydration query always executes independently for its viewer.
    const oldTopK = process.env.DISCOVERY_SQL_TOPK;
    const oldThin = process.env.DISCOVERY_THIN_SQL_TOPK;
    const oldInline = process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
    const viewers = [VIEWER, ...Array.from({ length: 9 }, (_, i) =>
      '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'))];
    const query = (requesterId: string) => ({
      viewport: VIEWPORT, zoom: 16, requesterId, rankBy: 'relevance' as const,
    });
    const ids = (response: Awaited<ReturnType<typeof service.nearby>>): string[] =>
      response.points.filter((p) => p.kind !== 'cluster')
        .map((p) => p.kind + ':' + p.id).sort();
    const percentile = (values: number[], fraction: number): number => {
      const sorted = [...values].sort((a, b) => a - b);
      return Number((sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0).toFixed(2));
    };

    // A FIFO gate with reserved permits: new requests cannot jump the queue
    // while a previously waiting SQL statement is resuming on the microtask queue.
    class RankingGate {
      private available: number;
      private readonly pending: Array<() => void> = [];
      active = 0;
      peak = 0;

      constructor(readonly capacity: number) {
        if (!Number.isInteger(capacity) || capacity < 1) {
          throw new Error('Ranking gate capacity must be a positive integer');
        }
        this.available = capacity;
      }

      async run<T>(task: () => Promise<T>): Promise<{ result: T; waitMs: number }> {
        const enqueued = performance.now();
        if (this.available > 0 && this.pending.length === 0) {
          this.available -= 1;
        } else {
          await new Promise<void>((resolve) => { this.pending.push(resolve); });
        }
        const waitMs = performance.now() - enqueued;
        this.active += 1;
        this.peak = Math.max(this.peak, this.active);
        try {
          return { result: await task(), waitMs };
        } finally {
          this.active -= 1;
          const next = this.pending.shift();
          if (next) next();
          else this.available += 1;
        }
      }
    }

    interface QueryTiming {
      phase: 'ranking' | 'hydration';
      queueMs: number;
      acquireMs: number;
      executionMs: number;
    }

    try {
      process.env.DISCOVERY_SQL_TOPK = '0';
      process.env.DISCOVERY_THIN_SQL_TOPK = '0';
      delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      const references = new Map<string, string[]>();
      for (const viewer of viewers) {
        references.set(viewer, ids(await service.nearby(query(viewer))));
      }

      process.env.DISCOVERY_SQL_TOPK = '1';
      process.env.DISCOVERY_THIN_SQL_TOPK = '1';
      process.env.DISCOVERY_THIN_INLINE_CANDIDATES = '1';
      // Keep TypeORM pg pool fixed; change only ranking query concurrency.
      for (const limit of [1, 2, 4, 6, 10] as const) {
        const source = await new DataSource({
          type: 'postgres', url, entities: [], poolSize: 10,
          extra: { options: `-c search_path=${schema},public` },
        }).initialize();
        const gate = new RankingGate(limit);
        const samples: QueryTiming[] = [];
        const measured = {
          query: async <T>(sql: string, params: unknown[] = []): Promise<T> => {
            const phase: QueryTiming['phase'] =
              sql.includes('WITH candidates AS') ? 'ranking' : 'hydration';
            const execute = async (): Promise<{
              value: T; acquireMs: number; executionMs: number;
            }> => {
              const runner = source.createQueryRunner();
              const start = performance.now();
              try {
                await runner.connect();
                const connected = performance.now();
                const value = await runner.query(sql, params) as T;
                return {
                  value, acquireMs: connected - start,
                  executionMs: performance.now() - connected,
                };
              } finally {
                await runner.release();
              }
            };
            const outcome = phase === 'ranking'
              ? await gate.run(execute)
              : { result: await execute(), waitMs: 0 };
            samples.push({
              phase, queueMs: outcome.waitMs,
              acquireMs: outcome.result.acquireMs,
              executionMs: outcome.result.executionMs,
            });
            return outcome.result.value;
          },
        } as unknown as DataSource;
        const friends = {
          listFriendIds: async (): Promise<string[]> => [],
          listWhoAllowFriendsOnline: async (): Promise<Set<string>> => new Set<string>(),
        } as unknown as FriendsService;
        const presence = {
          whichAreOnline: async (): Promise<Set<string>> => new Set<string>(),
          lastSeenMap: async (): Promise<Map<string,string>> => new Map<string,string>(),
        } as unknown as PresenceService;
        const redis = {
          get: async (): Promise<null> => null,
          set: async (): Promise<'OK'> => 'OK',
        } as unknown as Redis;
        const measuredService = new DiscoveryService(measured, presence, friends, redis);
        try {
          // Exclude pool warmup from the A/B samples.
          expect(ids(await measuredService.nearby(query(VIEWER)))).toEqual(references.get(VIEWER));
          samples.length = 0;
          const batchStarted = performance.now();
          const result = await Promise.allSettled(viewers.map(async (viewer) => {
            const started = performance.now();
            const response = await measuredService.nearby(query(viewer));
            return { viewer, durationMs: performance.now() - started, keys: ids(response) };
          }));
          const wallMs = performance.now() - batchStarted;
          const durations: number[] = [];
          for (const entry of result) {
            if (entry.status === 'rejected') throw entry.reason;
            expect(entry.value.keys).toHaveLength(500);
            expect(entry.value.keys).toEqual(references.get(entry.value.viewer));
            durations.push(entry.value.durationMs);
          }
          const rank = samples.filter((item) => item.phase === 'ranking');
          const hydrate = samples.filter((item) => item.phase === 'hydration');
          expect(rank).toHaveLength(10);
          expect(hydrate).toHaveLength(10);
          expect(gate.active).toBe(0);
          expect(gate.peak).toBeLessThanOrEqual(limit);
          console.info('DISCOVERY_RANK_GATE_PROFILE', JSON.stringify({
            datasetSize: lastSize, viewers: viewers.length,
            poolSize: 10, rankConcurrency: limit, rankPeak: gate.peak,
            requestP50Ms: percentile(durations, 0.5),
            requestP95Ms: percentile(durations, 0.95),
            batchWallMs: Number(wallMs.toFixed(2)),
            rankQueueP95Ms: percentile(rank.map((item) => item.queueMs), 0.95),
            rankAcquireP95Ms: percentile(rank.map((item) => item.acquireMs), 0.95),
            rankSqlP95Ms: percentile(rank.map((item) => item.executionMs), 0.95),
            hydrateSqlP95Ms: percentile(hydrate.map((item) => item.executionMs), 0.95),
            scope: 'isolated PostGIS/DiscoveryService; mocked Redis/Friends/Presence; no HTTP',
          }));
        } finally {
          await source.destroy();
        }
      }
    } finally {
      if (oldTopK === undefined) delete process.env.DISCOVERY_SQL_TOPK;
      else process.env.DISCOVERY_SQL_TOPK = oldTopK;
      if (oldThin === undefined) delete process.env.DISCOVERY_THIN_SQL_TOPK;
      else process.env.DISCOVERY_THIN_SQL_TOPK = oldThin;
      if (oldInline === undefined) delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      else process.env.DISCOVERY_THIN_INLINE_CANDIDATES = oldInline;
    }
  }, 300_000);


  httpTest('measures ten authenticated HTTP clients with actual JWT strategy, Redis snapshot and presence', async () => {
    // The database is the exact 0063 UNION VIEW over benchmark-only minimal
    // physical tables. This is real Nest/Passport HTTP and Redis I/O, not a
    // fully migrated AppModule nor a production traffic reproduction.
    if (!httpRedisUrl) throw new Error('Missing disposable benchmark Redis URL');
    const oldJwtSecret = process.env.JWT_SECRET;
    const oldTopK = process.env.DISCOVERY_SQL_TOPK;
    const oldThin = process.env.DISCOVERY_THIN_SQL_TOPK;
    const oldInline = process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
    const secret = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    const viewers = [VIEWER, ...Array.from({ length: 9 }, (_, i) =>
      '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'))];
    const request = {
      viewport: VIEWPORT, zoom: 16, rankBy: 'relevance' as const,
    };
    const keys = (response: DiscoveryResponse): string[] =>
      response.points.filter((point) => point.kind !== 'cluster')
        .map((point) => point.kind + ':' + point.id).sort();
    const percentile = (durations: number[], fraction: number): number => {
      const sorted = [...durations].sort((a, b) => a - b);
      return Number((sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0).toFixed(2));
    };

    let redis: Redis | undefined;
    let app: INestApplication | undefined;
    const snapshots = new Set<string>();
    let insertedViewers = false;
    let friendId: string | undefined;
    try {
      process.env.JWT_SECRET = secret;
      // Benchmark modes stay request-specific, never enabled in production.
      process.env.DISCOVERY_SQL_TOPK = '0';
      process.env.DISCOVERY_THIN_SQL_TOPK = '0';
      process.env.DISCOVERY_THIN_INLINE_CANDIDATES = '0';
      redis = new Redis(httpRedisUrl, {
        lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 3_000,
      });
      await redis.connect();
      expect(await redis.ping()).toBe('PONG');

      // The ten token subjects exist as test users but have NO discoverable
      // location. No real user identifiers or credentials are involved.
      await db.query(`
        INSERT INTO users(id,display_name,verification_level,visibility,location)
        SELECT v.id, 'HTTP Load Viewer', 'none', 'private', NULL
          FROM unnest($1::uuid[]) AS v(id)
        ON CONFLICT (id) DO NOTHING
      `, [viewers]);
      insertedViewers = true;
      const [friend] = await db.query<Array<{ id: string }>>(
        "SELECT id FROM users WHERE display_name = 'User 1' LIMIT 1",
      );
      if (!friend) throw new Error('Benchmark fixture has no friend candidate');
      friendId = friend.id;
      await redis.set('presence:user:' + friendId, '1', 'EX', 120);
      await redis.set('presence:last_seen:' + friendId, String(Date.now()), 'EX', 120);
      const presence = new PresenceService(redis, db);
      expect(await presence.whichAreOnline([friendId])).toEqual(new Set([friendId]));
      expect((await presence.lastSeenMap([friendId])).has(friendId)).toBe(true);

      // Friends remains a permission-only fixture; online and last-seen values
      // are fetched by REAL PresenceService methods over REAL Redis.
      const friends = {
        listFriendIds: async (): Promise<string[]> => [friendId!],
        listWhoAllowFriendsOnline: async (): Promise<Set<string>> => new Set([friendId!]),
      } as unknown as FriendsService;
      const live = new DiscoveryService(db, presence, friends, redis);
      const moduleRef = await Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({ secret, signOptions: { expiresIn: '5m' } }),
        ],
        controllers: [DiscoveryController],
        providers: [
          JwtStrategy,
          { provide: DiscoveryService, useValue: live },
          { provide: PlaceMapDiscoveryService, useValue: { nearby: async () => ({}) } },
        ],
      }).compile();
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(new ValidationPipe({
        whitelist: true, transform: true, forbidNonWhitelisted: true,
      }));
      await app.listen(0, '127.0.0.1');
      const address = app.getHttpServer() as { address(): AddressInfo | string | null };
      const port = address.address();
      if (typeof port === 'string' || !port) throw new Error('No HTTP test port');
      const url = `http://127.0.0.1:${port.port}/api/v1/discovery/nearby`;
      const jwtService = moduleRef.get(JwtService);
      const post = (token?: string): Promise<Response> =>
        fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: 'Bearer ' + token } : {}),
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(60_000),
        });
      // The actual JwtAuthGuard must reject unauthenticated HTTP requests.
      const unauthenticated = await post();
      expect(unauthenticated.status).toBe(401);
      const invalid = await post('not-a-real-jwt');
      expect(invalid.status).toBe(401);

      const baseline = new Map<string, string[]>();
      for (const viewer of viewers) {
        const expected = await live.nearby({ ...request, requesterId: viewer });
        baseline.set(viewer, keys(expected));
        expect(keys(expected)).toHaveLength(500);
        snapshots.add('discovery:snap:' + viewer + ':' + expected.viewportHash);
      }
      process.env.DISCOVERY_SQL_TOPK = '1';
      process.env.DISCOVERY_THIN_SQL_TOPK = '1';
      process.env.DISCOVERY_THIN_INLINE_CANDIDATES = '1';

      const startBatch = performance.now();
      const completed = await Promise.allSettled(viewers.map(async (viewer) => {
        const token = jwtService.sign({ sub: viewer, email: 'load@invalid.example' });
        const started = performance.now();
        const response = await post(token);
        const elapsedMs = performance.now() - started;
        // Only parse 200 responses: do not log JWTs or user-specific payloads.
        if (response.status !== 200) {
          throw new Error('Authenticated discovery HTTP response was not 200');
        }
        const body = await response.json() as DiscoveryResponse;
        return { viewer, body, elapsedMs };
      }));
      const wallMs = performance.now() - startBatch;
      const elapsed: number[] = [];
      for (const result of completed) {
        if (result.status === 'rejected') throw result.reason;
        const { viewer, body, elapsedMs } = result.value;
        expect(keys(body)).toHaveLength(500);
        expect(keys(body)).toEqual(baseline.get(viewer));
        // A live Redis snapshot was saved under the authenticated identity.
        const key = 'discovery:snap:' + viewer + ':' + body.viewportHash;
        snapshots.add(key);
        const stored = await redis.get(key);
        expect(stored).not.toBeNull();
        elapsed.push(elapsedMs);
      }
      console.info('DISCOVERY_AUTH_HTTP_REDIS_BENCH', JSON.stringify({
        fixtureEntities: lastSize, distinctJwtSubjects: viewers.length,
        requests: elapsed.length, p50Ms: percentile(elapsed, 0.5),
        p95Ms: percentile(elapsed, 0.95),
        batchWallMs: Number(wallMs.toFixed(2)),
        authorizedTop500Parity: true, unauthenticatedRejected: true,
        postgres: '0063 view on minimal benchmark physical tables',
        redis: 'real DB 15', presence: 'real Redis-backed PresenceService',
        friends: 'permission-stubbed', jwt: 'real JwtStrategy',
        scope: 'in-process Nest HTTP; no production AppModule, full schema or mobile network',
      }));
    } finally {
      // Never flush a Redis database: clean only test-owned keys.
      if (redis) {
        const cleanup = [...snapshots];
        if (friendId) {
          cleanup.push('presence:user:' + friendId);
          cleanup.push('presence:last_seen:' + friendId);
        }
        if (cleanup.length > 0) await redis.del(...cleanup);
      }
      if (app) await app.close();
      if (redis) redis.disconnect();
      if (insertedViewers) {
        await db.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [viewers]);
      }
      if (oldJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = oldJwtSecret;
      if (oldTopK === undefined) delete process.env.DISCOVERY_SQL_TOPK;
      else process.env.DISCOVERY_SQL_TOPK = oldTopK;
      if (oldThin === undefined) delete process.env.DISCOVERY_THIN_SQL_TOPK;
      else process.env.DISCOVERY_THIN_SQL_TOPK = oldThin;
      if (oldInline === undefined) delete process.env.DISCOVERY_THIN_INLINE_CANDIDATES;
      else process.env.DISCOVERY_THIN_INLINE_CANDIDATES = oldInline;
    }
  }, 240_000);

});
