-- Historical story rows may contain the raw GPS submitted during story creation.
-- Newly created stories persist the H3 r10 centroid; backfill the geography
-- column for pre-fix rows without changing public coordinates or H3 indexes.
-- Repeat-safe; assess row counts and lock impact on staging before production.
UPDATE stories
   SET location = ST_SetSRID(ST_MakePoint(approx_lng, approx_lat), 4326)::geography
 WHERE location IS NOT NULL
   AND (
     ST_Y(location::geometry) IS DISTINCT FROM approx_lat
     OR ST_X(location::geometry) IS DISTINCT FROM approx_lng
   );
