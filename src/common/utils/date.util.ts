/**
 * ============================================================================
 *  Date / time helpers
 * ============================================================================
 *
 * The app stores `createdAt` / `updatedAt` as Korean local time (Asia/Seoul).
 * Before this helper existed, the same moment-timezone expression was copied
 * into seven places across the code base. Keeping it in ONE function means:
 *   - every record is timestamped in exactly the same way
 *   - when the storage format changes later, only this file has to change
 *
 * ----------------------------------------------------------------------------
 *  Known limitation (to be fixed in a later step, together with migrations)
 * ----------------------------------------------------------------------------
 * The value is a plain text like "2026-11-15 14:30:00.123" WITHOUT any time
 * zone information, written into `timestamp` columns (also without time zone).
 * Anyone reading the data later has to "just know" that it is Seoul time.
 *
 * The usual best practice is the opposite:
 *   - store an absolute moment in time (UTC) in a `timestamptz` column
 *   - convert to a local time zone only when DISPLAYING it (in the app)
 *
 * Switching to that requires converting the existing rows, so it is done in a
 * separate step with a database migration. Until then this helper keeps the
 * stored values exactly as they were.
 */
import moment from 'moment-timezone';

/** The time zone used for all stored timestamps (see the note above). */
const STORAGE_TIME_ZONE = 'Asia/Seoul';

/** Format of the stored text, e.g. "2026-11-15 14:30:00.123". */
const STORAGE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';

/**
 * Returns the current time in Seoul as text, e.g. "2026-11-15 14:30:00.123".
 *
 * This is the value written to `createdAt` / `updatedAt` columns.
 * Some callers pass the text to `new Date(...)` before saving; others hand the
 * text to TypeORM directly. Both end up as the same Seoul wall-clock time in
 * the database (as long as the server process itself runs in the Seoul time
 * zone, which is how this app has always been run).
 */
export function currentSeoulTimestamp(): string {
  return moment().tz(STORAGE_TIME_ZONE).format(STORAGE_FORMAT);
}
