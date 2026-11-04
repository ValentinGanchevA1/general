import { buildThinCandidateSql, type ThinCandidateOptions } from './sql-thin-candidates';

const base: ThinCandidateOptions = {
  cellColumn: 'location_h3_r8',
  friendParam: null,
  topicParam: null,
  listingMode: undefined,
  marketplaceKind: undefined,
};

describe('source-specific thin discovery candidates', () => {
  it('selects native ranking columns without expensive JSON metadata', () => {
    const sql = buildThinCandidateSql(base);
    expect(sql).toContain('FROM users u');
    expect(sql).toContain('FROM events e');
    expect(sql).toContain('FROM listings l');
    expect(sql).toContain('ST_SnapToGrid(u.location::geometry, 0.02)');
    expect(sql).toContain("e.starts_at > NOW() - interval '1 day'");
    expect(sql).toContain("l.status = 'active'");
    expect(sql).toContain('l.expires_at > NOW()');
    expect(sql).toContain('EXISTS (SELECT 1 FROM users host');
    expect(sql).toContain('EXISTS (SELECT 1 FROM users seller');
    expect(sql).not.toContain('jsonb_build_object');
    expect(sql).not.toContain('FROM v_discoverable_entity');
    expect(sql.match(/AND NOT EXISTS \(/g)).toHaveLength(3);
    expect(sql.match(/visibility = 'public'/g)).toHaveLength(3);
    expect(sql.match(/id <> \$3::uuid/g)).toHaveLength(3);
    expect(sql).toContain('ub.blocker_id = $3::uuid AND ub.blocked_id = e.host_id');
    expect(sql).toContain('ub.blocked_id = $3::uuid AND ub.blocker_id = l.seller_id');
  });

  it('keeps requester, friends, topic, listing mode and marketplace filters index-safe', () => {
    const sql = buildThinCandidateSql({
      ...base, cellColumn: 'location_h3_r10',
      friendParam: 4, topicParam: 5,
      listingMode: 'sell', marketplaceKind: 'service',
    });
    expect(sql).toContain('u.location_h3_r10 = ANY($1::text[])');
    expect(sql).toContain('e.location_h3_r10 = ANY($1::text[])');
    expect(sql).toContain('l.location_h3_r10 = ANY($1::text[])');
    expect(sql).toContain('u.id = ANY($4::uuid[])');
    expect(sql).toContain('e.id = ANY($4::uuid[])');
    expect(sql).toContain('l.id = ANY($4::uuid[])');
    expect(sql).toContain('g88_slugify(e.title) = $5');
    expect(sql).toContain('g88_slugify(l.category) = $5');
    expect(sql).toContain("COALESCE(l.mode, 'sell') = 'sell'");
    expect(sql).toContain("COALESCE(l.marketplace_kind, 'for_sale') = 'service'");
    expect(sql).not.toContain('undefined');
  });

  it('rejects non-whitelisted H3 column names instead of interpolating input', () => {
    expect(() => buildThinCandidateSql({
      ...base, cellColumn: "location_h3_r8; DROP TABLE users",
    })).toThrow('Unsupported discovery H3 resolution');
  });
  it('materializes bilateral blocked accounts exactly once for all three entity kinds', () => {
    const sql = buildThinCandidateSql({ ...base, blockedSetCte: true });
    expect(sql).toContain('WITH blocked_users AS MATERIALIZED');
    expect(sql).toContain('SELECT blocked_id AS user_id FROM user_blocks WHERE blocker_id = $3::uuid');
    expect(sql).toContain('SELECT blocker_id AS user_id FROM user_blocks WHERE blocked_id = $3::uuid');
    expect(sql.match(/SELECT 1 FROM blocked_users bu WHERE bu.user_id = /g)).toHaveLength(3);
    expect(sql).toContain('bu.user_id = u.id');
    expect(sql).toContain('bu.user_id = e.host_id');
    expect(sql).toContain('bu.user_id = l.seller_id');
    expect(sql.match(/WHERE blocker_id = \$3::uuid/g)).toHaveLength(1);
    expect(sql.match(/WHERE blocked_id = \$3::uuid/g)).toHaveLength(1);
    expect(sql).not.toContain('jsonb_build_object');
  });

  it('leaves the original per-entity bilateral guard untouched when the flag is off', () => {
    const baseline = buildThinCandidateSql(base);
    expect(buildThinCandidateSql({ ...base, blockedSetCte: false })).toBe(baseline);
    expect(baseline).not.toContain('blocked_users AS MATERIALIZED');
    expect(baseline.match(/FROM user_blocks ub/g)).toHaveLength(3);
  });

});
