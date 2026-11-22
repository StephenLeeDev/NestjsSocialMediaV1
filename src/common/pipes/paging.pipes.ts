/**
 * ============================================================================
 *  Pipes for the paging query parameters `?page=<n>&limit=<n>`
 * ============================================================================
 *
 * Every list endpoint pages its results. Usage in a controller:
 *
 *   getFeed(
 *     @Query('page', ParsePagePipe) page: number,
 *     @Query('limit', ParseLimitPipe) limit: number,
 *   )
 *
 * A "pipe" runs before the controller method and turns the raw query text
 * into a value the method can trust, or rejects the request with 400.
 *
 * Why not just `ParseIntPipe` (what the endpoints used before):
 *   It only checks "is this a whole number". page=0 or a negative limit then
 *   reached the SQL query as a negative OFFSET / LIMIT, and PostgreSQL's error
 *   came back as 500 Internal Server Error, which says "the server is broken"
 *   instead of "your request is wrong". And without an upper bound,
 *   `limit=1000000` made one request load a whole table.
 */
import { BadRequestException, PipeTransform } from '@nestjs/common';

/**
 * The largest page a client may ask for. The Flutter app asks for 3 to 10
 * items per page, so 100 leaves plenty of room while still protecting the
 * database from "give me everything" requests.
 */
export const MAX_PAGE_LIMIT = 100;

/**
 * Parses `value` as a whole number between `min` and `max` (both included).
 *
 * @param name Parameter name, used in the error message.
 * @throws BadRequestException (400) for anything else.
 */
function parseIntInRange(
  value: unknown,
  name: string,
  min: number,
  max: number,
): number {
  // Only plain decimal digits with an optional minus sign: "12" or "-3".
  // (`Number("1e2")` or `parseInt("12abc")` would quietly accept odd input.)
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^-?\d+$/.test(text)) {
    throw new BadRequestException(`${name} must be a whole number`);
  }

  const number = Number(text);
  if (number < min || number > max) {
    throw new BadRequestException(
      max === Number.MAX_SAFE_INTEGER
        ? `${name} must be ${min} or more`
        : `${name} must be between ${min} and ${max}`,
    );
  }
  return number;
}

/**
 * `?page=`: the 1-based page number (1 = first page). Must be 1 or more.
 * There is no upper bound: a page after the last one is simply empty.
 */
export class ParsePagePipe implements PipeTransform<unknown, number> {
  transform(value: unknown): number {
    return parseIntInRange(value, 'page', 1, Number.MAX_SAFE_INTEGER);
  }
}

/** `?limit=`: items per page. Must be between 1 and MAX_PAGE_LIMIT. */
export class ParseLimitPipe implements PipeTransform<unknown, number> {
  transform(value: unknown): number {
    return parseIntInRange(value, 'limit', 1, MAX_PAGE_LIMIT);
  }
}
