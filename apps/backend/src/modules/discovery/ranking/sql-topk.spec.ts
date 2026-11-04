import { buildRelevanceTopKSql } from './sql-topk';

const params = {
  viewerLat: 4, viewerLng: 5, nowMs: 6,
  friends: 7, online: 8, lastSeen: 9, limit: 10,
};

describe('PostgreSQL relevance SQL candidate CTE mode', () => {
  const where = "FROM v_discoverable_entity WHERE visibility = 'public'";
  const lat = 'ST_Y(location::geometry)';
  const lng = 'ST_X(location::geometry)';

  it('keeps materialized candidates by default for every existing caller', () => {
    const standard = buildRelevanceTopKSql(where, lat, lng, params);
    expect(standard).toContain('WITH candidates AS MATERIALIZED (');
    expect(standard).toContain(where);
    expect(standard).not.toContain('NOT MATERIALIZED');
    const thin = buildRelevanceTopKSql(where, lat, lng, params,
      "SELECT id,kind,lat,lng,verification,starts_at,created_at,listing_mode FROM candidate_source");
    expect(thin).toContain('WITH candidates AS MATERIALIZED (');
  });

  it('only changes PostgreSQL planner hint under explicit opt-in', () => {
    const candidate = "SELECT id,kind,lat,lng,verification,starts_at,created_at,listing_mode FROM candidate_source";
    const oldSql = buildRelevanceTopKSql(where, lat, lng, params, candidate);
    const inlineSql = buildRelevanceTopKSql(where, lat, lng, params, candidate, true);
    expect(inlineSql).toContain('WITH candidates AS NOT MATERIALIZED (');
    expect(inlineSql.replace('NOT MATERIALIZED', 'MATERIALIZED')).toBe(oldSql);
    expect(inlineSql).toContain('ORDER BY rank_score DESC, kind ASC, id ASC');
  });
});
