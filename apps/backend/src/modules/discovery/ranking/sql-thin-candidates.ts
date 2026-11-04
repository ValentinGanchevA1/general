import type { ListingMode, MarketplaceKind } from '@g88/shared';

/**
 * Native-column candidate projection for the existing SQL relevance scorer.
 *
 * This mirrors the eligibility of the 0063 discovery UNION view but avoids
 * constructing full JSON metadata for every visible candidate. The public
 * hydration query still independently enforces all access filters.
 */
export interface ThinCandidateOptions {
  cellColumn: string;
  friendParam: number | null;
  topicParam: number | null;
  listingMode: ListingMode | undefined;
  marketplaceKind: MarketplaceKind | undefined;
  /** Optional opt-in: evaluate the requester's block set once per shortlist. */
  blockedSetCte?: boolean;
}

const H3_CELL_COLUMNS = new Set([
  'location_h3_r4', 'location_h3_r5', 'location_h3_r6',
  'location_h3_r7', 'location_h3_r8', 'location_h3_r9',
  'location_h3_r10',
]);

const MARKETPLACE_KINDS: Record<MarketplaceKind, string> = {
  for_sale: 'for_sale',
  service: 'service',
  job: 'job',
  local_deal: 'local_deal',
};

function blockGuard(ownerId: string, batched: boolean): string {
  if (batched) {
    // One shared two-way blocked-identity set per query instead of checking
    // both directions against user_blocks for every visible entity.
    return `AND NOT EXISTS (
      SELECT 1 FROM blocked_users bu WHERE bu.user_id = ${ownerId}
    )`;
  }
  return `AND NOT EXISTS (
    SELECT 1 FROM user_blocks ub
     WHERE (ub.blocker_id = $3::uuid AND ub.blocked_id = ${ownerId})
        OR (ub.blocked_id = $3::uuid AND ub.blocker_id = ${ownerId})
  )`;
}

export function buildThinCandidateSql(options: ThinCandidateOptions): string {
  const { cellColumn, friendParam, topicParam, listingMode, marketplaceKind } = options;
  const batched = options.blockedSetCte === true;
  if (!H3_CELL_COLUMNS.has(cellColumn)) {
    throw new Error('Unsupported discovery H3 resolution');
  }

  // Bind indices refer to the same [cells,kinds,requester,?friends,?topic]
  // array as the normal v_discoverable_entity query. No user-controlled
  // values are interpolated into SQL.
  const friendFilter = (alias: string): string =>
    friendParam == null ? '' : `AND ${alias}.id = ANY($${friendParam}::uuid[])`;
  const topicFilter = (column: string): string =>
    topicParam == null ? '' : `AND g88_slugify(${column}) = $${topicParam}`;

  const listingModeFilter = listingMode === 'buy'
    ? "AND l.mode = 'buy'"
    : listingMode === 'sell'
      ? "AND COALESCE(l.mode, 'sell') = 'sell'"
      : '';
  const marketplaceFilter = marketplaceKind == null
    ? ''
    : `AND COALESCE(l.mode, 'sell') = 'sell'
       AND COALESCE(l.marketplace_kind, 'for_sale') = '${MARKETPLACE_KINDS[marketplaceKind]}'`;

  const blockCte = batched ? `WITH blocked_users AS MATERIALIZED (
      SELECT blocked_id AS user_id FROM user_blocks WHERE blocker_id = $3::uuid
      UNION
      SELECT blocker_id AS user_id FROM user_blocks WHERE blocked_id = $3::uuid
    )` : '';

  return `
    ${blockCte}
    SELECT u.id, 'user'::text AS kind,
           ST_Y(ST_SnapToGrid(u.location::geometry, 0.02)) AS lat,
           ST_X(ST_SnapToGrid(u.location::geometry, 0.02)) AS lng,
           u.verification_level::text AS verification,
           NULL::text AS starts_at, NULL::text AS created_at,
           NULL::text AS listing_mode
      FROM users u
     WHERE 'user' = ANY($2::text[])
       AND u.${cellColumn} = ANY($1::text[])
       AND u.visibility = 'public'
       AND u.id <> $3::uuid
       AND u.deleted_at IS NULL AND u.location IS NOT NULL
       ${blockGuard('u.id', batched)}
       ${friendFilter('u')}

    UNION ALL

    SELECT e.id, 'event'::text AS kind,
           ST_Y(e.location::geometry) AS lat,
           ST_X(e.location::geometry) AS lng,
           NULL::text AS verification, e.starts_at::text AS starts_at,
           NULL::text AS created_at, NULL::text AS listing_mode
      FROM events e
     WHERE 'event' = ANY($2::text[])
       AND e.${cellColumn} = ANY($1::text[])
       AND e.visibility = 'public'
       AND e.id <> $3::uuid
       AND e.deleted_at IS NULL
       AND e.starts_at > NOW() - interval '1 day'
       AND EXISTS (SELECT 1 FROM users host WHERE host.id = e.host_id)
       ${blockGuard('e.host_id', batched)}
       ${friendFilter('e')}
       ${topicFilter('e.title')}

    UNION ALL

    SELECT l.id, 'listing'::text AS kind,
           ST_Y(l.location::geometry) AS lat,
           ST_X(l.location::geometry) AS lng,
           NULL::text AS verification,
           NULL::text AS starts_at, l.created_at::text AS created_at,
           l.mode::text AS listing_mode
      FROM listings l
     WHERE 'listing' = ANY($2::text[])
       AND l.${cellColumn} = ANY($1::text[])
       AND l.visibility = 'public'
       AND l.id <> $3::uuid
       AND l.deleted_at IS NULL AND l.status = 'active'
       AND (l.expires_at IS NULL OR l.expires_at > NOW())
       AND EXISTS (SELECT 1 FROM users seller WHERE seller.id = l.seller_id)
       ${blockGuard('l.seller_id', batched)}
       ${friendFilter('l')}
       ${topicFilter('l.category')}
       ${listingModeFilter}
       ${marketplaceFilter}
  `;
}
