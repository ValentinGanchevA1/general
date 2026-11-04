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
import * as h3 from 'h3-js';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { cellsForViewport, type Viewport } from '@g88/shared';

import { DiscoveryService } from './discovery.service';
import { FriendsService } from '../friends/friends.service';
import { PresenceService } from '../presence/presence.service';

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
      try {
        for (const variant of ['js','sql'] as const) {
          process.env.DISCOVERY_SQL_TOPK=variant==='sql'?'1':'0';
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
            q.sql.includes('FROM v_discoverable_entity'))) {
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
});
