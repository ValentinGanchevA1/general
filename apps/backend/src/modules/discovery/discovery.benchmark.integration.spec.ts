/**
 * Opt-in PostgreSQL/PostGIS query-shape benchmark for the actual DiscoveryService.
 *
 * Runs only against an explicitly acknowledged disposable local database.
 * This schema models the v_discoverable_entity projection and its H3 indexes,
 * NOT the full production users/events/listings UNION view. Results measure
 * backend DB/query + ranking cost, not mobile FPS or HTTP round-trip latency.
 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import * as h3 from 'h3-js';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

import type { Viewport } from '@g88/shared';
import { DiscoveryService } from './discovery.service';
import { FriendsService } from '../friends/friends.service';
import { PresenceService } from '../presence/presence.service';

const connectionUrl = process.env.DISCOVERY_BENCH_DATABASE_URL;
const authorized = process.env.DISCOVERY_BENCH_ACK_DISPOSABLE === 'YES';
const localDatabase = (() => {
  if (!connectionUrl) return false;
  try {
    const url = new URL(connectionUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      && url.pathname.endsWith('_bench');
  } catch {
    return false;
  }
})();
const suite = connectionUrl && authorized && localDatabase ? describe : describe.skip;

const VIEWER = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const VIEWPORT: Viewport = {
  sw: { lat: 43.175, lng: 27.885 },
  ne: { lat: 43.235, lng: 27.945 },
};
const SIZES = process.env.DISCOVERY_BENCH_QUICK === 'YES'
  ? [10_000] as const
  : [10_000, 50_000, 100_000] as const;
const SAMPLE_RUNS = 5;

interface TimedQuery {
  sql: string;
  params: unknown[];
  milliseconds: number;
  rows: number;
}
interface ExplainPlan {
  'Node Type'?: string;
  'Index Name'?: string;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
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

function summarizePlan(plan: ExplainPlan): { nodes: string[]; indexNames: string[] } {
  const nodes: string[] = [];
  const indexNames: string[] = [];
  const visit = (node: ExplainPlan): void => {
    nodes.push(node['Node Type'] ?? '?');
    if (node['Index Name']) indexNames.push(node['Index Name']);
    for (const child of node.Plans ?? []) visit(child);
  };
  visit(plan);
  return { nodes, indexNames };
}

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? 0;
}

suite('Map Core PostGIS discovery benchmark — disposable database only', () => {
  let bootstrap: DataSource;
  let database: DataSource;
  let service: DiscoveryService;
  let queries: TimedQuery[] = [];
  const schema = `map_bench_${randomUUID().replaceAll('-', '')}`;
  let lastSize = 0;

  beforeAll(async () => {
    bootstrap = await new DataSource({
      type: 'postgres',
      url: connectionUrl,
      entities: [],
    }).initialize();

    // The workflow supplies postgis/postgis:16-3.4; do not touch non-local DBs.
    await bootstrap.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await bootstrap.query(`CREATE SCHEMA "${schema}"`);
    database = await new DataSource({
      type: 'postgres',
      url: connectionUrl,
      entities: [],
      extra: { options: `-c search_path=${schema},public` },
    }).initialize();

    await database.query(`
      CREATE TABLE bench_positions (
        idx integer PRIMARY KEY,
        lat double precision NOT NULL,
        lng double precision NOT NULL,
        r4 text, r5 text, r6 text, r7 text, r8 text, r9 text, r10 text
      );
      CREATE TABLE bench_entities (
        id uuid PRIMARY KEY,
        kind text NOT NULL CHECK (kind IN ('user','event','listing')),
        location geography(Point,4326) NOT NULL,
        location_h3_r4 text, location_h3_r5 text, location_h3_r6 text,
        location_h3_r7 text, location_h3_r8 text, location_h3_r9 text,
        location_h3_r10 text,
        visibility text NOT NULL CHECK (visibility IN ('public','private')),
        meta jsonb NOT NULL
      );
      CREATE VIEW v_discoverable_entity AS SELECT * FROM bench_entities;
      CREATE TABLE user_blocks (blocker_id uuid NOT NULL, blocked_id uuid NOT NULL);
      CREATE INDEX bench_h3_r8 ON bench_entities(location_h3_r8);
      CREATE INDEX bench_h3_r9 ON bench_entities(location_h3_r9);
      CREATE INDEX bench_h3_r10 ON bench_entities(location_h3_r10);
      CREATE INDEX bench_location_gist ON bench_entities USING GIST(location);
      CREATE INDEX bench_blocks_blocker ON user_blocks(blocker_id,blocked_id);
      CREATE INDEX bench_blocks_blocked ON user_blocks(blocked_id,blocker_id);
    `);

    // 625 reproducible geographic positions; all fit within the zoom-16 viewport.
    // Precompute H3 cells in JS just as the real write path does.
    const positions: Array<{
      idx: number; lat: number; lng: number;
      r4: string; r5: string; r6: string; r7: string;
      r8: string; r9: string; r10: string;
    }> = [];
    for (let y = 0; y < 25; y += 1) {
      for (let x = 0; x < 25; x += 1) {
        const lat = 43.205 + (y - 12) * 0.0016;
        const lng = 27.915 + (x - 12) * 0.0016;
        positions.push({
          idx: y * 25 + x, lat, lng,
          r4: h3.latLngToCell(lat, lng, 4),
          r5: h3.latLngToCell(lat, lng, 5),
          r6: h3.latLngToCell(lat, lng, 6),
          r7: h3.latLngToCell(lat, lng, 7),
          r8: h3.latLngToCell(lat, lng, 8),
          r9: h3.latLngToCell(lat, lng, 9),
          r10: h3.latLngToCell(lat, lng, 10),
        });
      }
    }
    await database.query(`
      INSERT INTO bench_positions(idx,lat,lng,r4,r5,r6,r7,r8,r9,r10)
      SELECT idx,lat,lng,r4,r5,r6,r7,r8,r9,r10
        FROM jsonb_to_recordset($1::jsonb) AS pos(
          idx integer, lat double precision, lng double precision,
          r4 text, r5 text, r6 text, r7 text,
          r8 text, r9 text, r10 text)
    `, [JSON.stringify(positions)]);

    await database.query(`
      INSERT INTO user_blocks(blocker_id,blocked_id) VALUES
        ($1::uuid, md5('owner5')::uuid),
        (md5('owner9')::uuid, $1::uuid),
        ($1::uuid, md5('1')::uuid)
    `, [VIEWER]);

    const tracked = {
      query: async <T>(sql: string, params: unknown[] = []): Promise<T> => {
        const start = performance.now();
        const result = await database.query<T>(sql, params);
        queries.push({
          sql, params,
          milliseconds: performance.now() - start,
          rows: Array.isArray(result) ? result.length : 0,
        });
        return result;
      },
    } as unknown as DataSource;
    const presence = {
      whichAreOnline: async (): Promise<Set<string>> => new Set<string>(),
      lastSeenMap: async (): Promise<Map<string, string>> => new Map<string, string>(),
    } as unknown as PresenceService;
    const friends = {
      listFriendIds: async (): Promise<string[]> => [],
      listWhoAllowFriendsOnline: async (): Promise<Set<string>> => new Set<string>(),
    } as unknown as FriendsService;
    const redis = {
      set: async (): Promise<'OK'> => 'OK',
      get: async (): Promise<null> => null,
    } as unknown as Redis;
    service = new DiscoveryService(tracked, presence, friends, redis);
  }, 60_000);

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
    if (bootstrap?.isInitialized) {
      await bootstrap.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await bootstrap.destroy();
    }
  }, 30_000);

  async function addEntities(toSize: number): Promise<void> {
    await database.query(`
      WITH numbered AS (
        SELECT n, p.*,
          CASE WHEN n % 10 < 4 THEN 'user'
               WHEN n % 10 < 7 THEN 'event'
               ELSE 'listing' END AS kind
        FROM generate_series($1::integer, $2::integer) AS s(n)
        JOIN bench_positions p ON p.idx = n % 625
      )
      INSERT INTO bench_entities (
        id, kind, location, location_h3_r4, location_h3_r5,
        location_h3_r6, location_h3_r7, location_h3_r8,
        location_h3_r9, location_h3_r10, visibility, meta
      )
      SELECT md5(n::text)::uuid, kind,
        ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography,
        r4,r5,r6,r7,r8,r9,r10,
        CASE WHEN n % 37 = 0 THEN 'private' ELSE 'public' END,
        CASE WHEN kind = 'user' THEN jsonb_build_object(
          'displayName', 'Benchmark user',
          'verification', CASE WHEN n % 9 = 0 THEN 'id' ELSE 'phone' END,
          'online', false, 'lastSeenAt', NULL
        )
        WHEN kind = 'event' THEN jsonb_build_object(
          'title', 'Benchmark event',
          'startsAt', statement_timestamp() + ((n % 72) || ' hours')::interval,
          'hostId', md5('owner' || (n % 70)::text)::uuid
        )
        ELSE jsonb_build_object(
          'title', 'Benchmark listing',
          'category', 'general',
          'mode', 'sell',
          'createdAt', statement_timestamp() - ((n % 240) || ' minutes')::interval,
          'sellerId', md5('owner' || (n % 70)::text)::uuid
        ) END
      FROM numbered
    `, [lastSize + 1, toSize]);
    lastSize = toSize;
    await database.query('ANALYZE bench_entities');
    await database.query('ANALYZE user_blocks');
  }

  async function explain(query: TimedQuery): Promise<unknown> {
    const rows = await database.query<ExplainRow[]>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.sql}`,
      query.params,
    );
    const envelope = rows[0]?.['QUERY PLAN'];
    const parsed = typeof envelope === 'string'
      ? JSON.parse(envelope) as ExplainRecord[]
      : envelope;
    const plan = parsed?.[0];
    if (!plan) throw new Error('PostGIS EXPLAIN did not return a plan');
    return {
      planningMs: plan['Planning Time'],
      executionMs: plan['Execution Time'],
      ...summarizePlan(plan.Plan),
    };
  }

  for (const size of SIZES) {
    it(`captures actual query plans and ranking timings at ${size} entities`, async () => {
      await addEntities(size);
      const [count] = await database.query<Array<{ n: string }>>(
        'SELECT COUNT(*)::text AS n FROM bench_entities',
      );
      expect(Number(count?.n)).toBe(size);

      for (const rankBy of ['relevance', 'distance', 'newest'] as const) {
        const latencies: number[] = [];
        let representativeQueries: TimedQuery[] = [];
        for (let run = 0; run <= SAMPLE_RUNS; run += 1) {
          queries = [];
          const start = performance.now();
          const response = await service.nearby({
            viewport: VIEWPORT, zoom: 16, requesterId: VIEWER, rankBy,
          });
          const totalMs = performance.now() - start;
          expect(response.points.length).toBe(500);
          expect(response.points.every((point) => point.kind !== 'cluster')).toBe(true);
          // This is a DB/Node elapsed time, not an HTTP or network p95.
          if (run > 0) latencies.push(totalMs);
          if (run === 1) representativeQueries = [...queries];
        }

        const plans = [];
        for (const call of representativeQueries.filter((q) => q.sql.includes('FROM v_discoverable_entity'))) {
          plans.push({
            rowsReturned: call.rows,
            queryMs: Number(call.milliseconds.toFixed(2)),
            explain: await explain(call),
          });
        }
        console.info('DISCOVERY_POSTGIS_BENCH', JSON.stringify({
          datasetSize: size, rankBy, samples: SAMPLE_RUNS,
          p50Ms: Number(percentile(latencies, 0.5).toFixed(2)),
          p95Ms: Number(percentile(latencies, 0.95).toFixed(2)),
          maxMs: Number(Math.max(...latencies).toFixed(2)),
          plans,
          scope: 'isolated indexed view; service + DB only; not production SLA',
        }));
      }

      const cluster = await service.nearby({
        viewport: VIEWPORT, zoom: 13, requesterId: VIEWER,
      });
      const visible = cluster.points.reduce((sum, point) =>
        point.kind === 'cluster' ? sum + point.count : sum, 0);
      const [eligible] = await database.query<Array<{ n: string }>>(`
        SELECT COUNT(*)::text AS n
        FROM bench_entities b WHERE b.visibility = 'public'
          AND NOT EXISTS (SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = $1 AND ub.blocked_id =
                     CASE WHEN b.kind = 'user' THEN b.id
                       WHEN b.kind = 'event' THEN (b.meta->>'hostId')::uuid
                       ELSE (b.meta->>'sellerId')::uuid END)
               OR (ub.blocked_id = $1 AND ub.blocker_id =
                     CASE WHEN b.kind = 'user' THEN b.id
                       WHEN b.kind = 'event' THEN (b.meta->>'hostId')::uuid
                       ELSE (b.meta->>'sellerId')::uuid END))
      `, [VIEWER]);
      // Both queries use the same populated viewport and H3-filtered set.
      expect(visible).toBe(Number(eligible?.n));
      console.info('DISCOVERY_POSTGIS_CLUSTER_COUNTS', JSON.stringify({
        datasetSize: size, aggregateCount: visible,
        clusterCount: cluster.points.length, effectiveH3Resolution: cluster.resolution,
      }));
    }, 900_000);
  }
});
