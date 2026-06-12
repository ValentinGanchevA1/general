-- 0023_slugify.sql — g88_slugify(): hashtag slug shared by trending + discovery.
--
-- P3.6 "filter map by topic" lets a user tap a trending topic and filter the map
-- to entities matching it. Trending topics are derived by slugifying event
-- titles / listing categories; the discovery filter must slug the SAME way or a
-- tapped topic matches nothing. This function is the canonical slug used by the
-- discovery topic filter.
--
-- ⚠️ Must stay byte-identical to `toHashtag()` in
--    apps/backend/src/modules/trending/trending.service.ts (minus the leading
--    '#', which callers add). If you change one, change the other.
--
-- Mirrors toHashtag: lower → trim → first 30 chars → drop non [a-z0-9 space -]
--   → runs of whitespace to '-' → collapse repeated '-' → trim leading/trailing '-'.
--
-- Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION g88_slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 left(btrim(lower(coalesce(input, ''))), 30),
                 '[^a-z0-9[:space:]-]', '', 'g'),
               '[[:space:]]+', '-', 'g'),
             '-{2,}', '-', 'g'),
           '^-|-$', '', 'g');
$$;
