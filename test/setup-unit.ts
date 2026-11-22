/**
 * ============================================================================
 *  Environment for the UNIT tests (`npm test`, the `*.spec.ts` files in src/)
 * ============================================================================
 *
 * Runs before every unit test file (see "setupFiles" in package.json).
 *
 * Unit tests do not start the app, so no `.env` is loaded. Responses turn
 * stored image paths into URLs with SERVER_URL (common/utils/image-url.util.ts),
 * so a fixed, obviously fake address is set here. Tests can then expect exact
 * URLs such as "http://server.test/images/thumb.png".
 *
 * (The e2e tests have their own, larger setup: test/setup-env.ts.)
 */
process.env.SERVER_URL = 'http://server.test';
