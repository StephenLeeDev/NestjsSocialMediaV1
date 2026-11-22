-- ============================================================================
--  Likes and bookmarks: array columns → join tables
-- ============================================================================
--
-- WHEN: run ONCE per existing database, BEFORE starting a server version
--       that contains post/reaction/post-like.entity.ts.
--
-- WHY:  With DB_SYNCHRONIZE=true, TypeORM makes the schema match the
--       entities when the server starts. It would DROP the old array columns
--       (post_entity.likes, post_entity."bookMarkedUsers", "user"."bookMarks")
--       and create EMPTY join tables, so every existing like and bookmark
--       would be lost. This script copies the data first.
--
-- HOW:  psql -h localhost -U postgres -d social-media-app-v1 \
--         -f database/migrations/2026-11-22-likes-bookmarks-to-join-tables.sql
--
-- SAFE TO RE-RUN: every step checks whether it is still needed.
--
-- AFTER: start the server once. TypeORM then adds what this script leaves to
--        it (the foreign keys with ON DELETE CASCADE and the postId indexes,
--        with TypeORM's own names). The rows copied here are kept.
--
-- New databases (e.g. the e2e test database) do not need this script: there
-- is no old data, and TypeORM creates the tables from the entities.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
--  1. The two join tables (same columns as the entities)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS post_like (
  "userEmail" varchar   NOT NULL,
  "postId"    integer   NOT NULL,
  "createdAt" timestamp NOT NULL,
  PRIMARY KEY ("userEmail", "postId")
);

CREATE TABLE IF NOT EXISTS post_bookmark (
  "userEmail" varchar   NOT NULL,
  "postId"    integer   NOT NULL,
  "createdAt" timestamp NOT NULL,
  PRIMARY KEY ("userEmail", "postId")
);

-- ----------------------------------------------------------------------------
--  2. Copy the data, then drop the old columns
-- ----------------------------------------------------------------------------
--
-- The old arrays did not record WHEN something was liked or bookmarked, so
-- the copied rows get the post's creation time as an approximation.
--
-- Only pairs whose user AND post still exist are copied. The old arrays could
-- contain leftovers (e.g. ids of deleted posts), which the new foreign keys
-- would reject.
--
-- A bookmark was stored on BOTH sides, and the two sides could disagree after
-- concurrent requests. A bookmark found on EITHER side is kept (UNION).
--
-- Everything is wrapped in DO blocks so that a second run, when the old
-- columns are already gone, skips the copy instead of failing.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'post_entity' AND column_name = 'likes') THEN

    INSERT INTO post_like ("userEmail", "postId", "createdAt")
    SELECT DISTINCT liker.email, post.id, post."createdAt"
    FROM post_entity post
    CROSS JOIN LATERAL unnest(post.likes) AS liked_by(email)
    JOIN "user" liker ON liker.email = liked_by.email
    ON CONFLICT DO NOTHING;

    ALTER TABLE post_entity DROP COLUMN likes;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'post_entity' AND column_name = 'bookMarkedUsers')
     AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user' AND column_name = 'bookMarks') THEN

    INSERT INTO post_bookmark ("userEmail", "postId", "createdAt")
    SELECT pair.email, post.id, post."createdAt"
    FROM (
      -- Side 1: the post's list of emails.
      SELECT saved_by.email, p.id AS post_id
      FROM post_entity p
      CROSS JOIN LATERAL unnest(p."bookMarkedUsers") AS saved_by(email)
      UNION
      -- Side 2: the user's list of post ids.
      SELECT u.email, saved.post_id
      FROM "user" u
      CROSS JOIN LATERAL unnest(u."bookMarks") AS saved(post_id)
    ) AS pair
    JOIN "user" saver ON saver.email = pair.email
    JOIN post_entity post ON post.id = pair.post_id
    ON CONFLICT DO NOTHING;

    ALTER TABLE post_entity DROP COLUMN "bookMarkedUsers";
    ALTER TABLE "user" DROP COLUMN "bookMarks";
  END IF;
END $$;

-- ----------------------------------------------------------------------------
--  3. Report
-- ----------------------------------------------------------------------------

SELECT 'post_like' AS "table", count(*) AS "rows" FROM post_like
UNION ALL
SELECT 'post_bookmark', count(*) FROM post_bookmark;

COMMIT;
