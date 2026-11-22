-- ============================================================================
--  Image references: full URLs → paths inside static/images/
-- ============================================================================
--
-- WHEN: run ONCE per existing database, together with the server version
--       that stores image PATHS (common/utils/image-url.util.ts). Before or
--       after restarting does not matter much: until it has run, the server
--       returns the old full URLs unchanged (see publicImageUrl's safety net),
--       so old images keep their old, possibly broken, addresses.
--
-- WHAT: every stored value of the form
--         http(s)://<any host>/images/<path>
--       becomes
--         <path>
--       e.g. "http://192.168.1.251:3001/images/dummy/6.jpeg" → "dummy/6.jpeg"
--
--       Columns: "user".thumbnail and post_entity."imageUrls" (an array; each
--       element is converted).
--
-- HOW:  psql -h localhost -U postgres -d social-media-app-v1 \
--         -f database/migrations/2026-11-22-image-urls-to-paths.sql
--
-- SAFE TO RE-RUN: values that are already paths do not match the pattern
-- and stay as they are. No schema change, so TypeORM's synchronize is not
-- involved.
-- ============================================================================

BEGIN;

-- "http://" or "https://", any host and port, then "/images/".
-- (A regular expression; '^' anchors it at the start of the text.)
\set url_prefix '''^https?://[^/]+/images/'''

UPDATE "user"
SET thumbnail = regexp_replace(thumbnail, :url_prefix, '')
WHERE thumbnail ~ :url_prefix;

UPDATE post_entity
SET "imageUrls" = ARRAY(
  -- unnest() turns the array into rows, WITH ORDINALITY keeps their order.
  SELECT regexp_replace(image, :url_prefix, '')
  FROM unnest("imageUrls") WITH ORDINALITY AS t(image, position)
  ORDER BY position
)
WHERE EXISTS (
  SELECT 1 FROM unnest("imageUrls") AS image WHERE image ~ :url_prefix
);

-- Report: how many values still look like URLs (should be 0).
SELECT 'user.thumbnail still a URL' AS "check", count(*) AS "rows"
FROM "user" WHERE thumbnail ~ '^https?://'
UNION ALL
SELECT 'post_entity.imageUrls still a URL', count(*)
FROM post_entity, unnest("imageUrls") AS image WHERE image ~ '^https?://';

COMMIT;
