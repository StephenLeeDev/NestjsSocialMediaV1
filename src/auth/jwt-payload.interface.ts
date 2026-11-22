/**
 * What the server puts inside every access token (the JWT "payload").
 *
 * Written in ONE place so that the three pieces of code that deal with tokens
 * agree on the shape:
 *   - AuthService      creates tokens     (`jwtService.signAsync(payload)`)
 *   - JwtStrategy      reads REST tokens  (the `Authorization: Bearer` header)
 *   - ChatGateway      reads socket tokens (the Socket.IO handshake)
 *
 * Only the email is stored. It identifies the user (it is the primary key of
 * the user table), and the user row is loaded fresh on every request, so a
 * deleted account cannot keep using an old token.
 *
 * Note: a JWT is SIGNED, not encrypted. Anyone holding the token can read the
 * payload, so nothing secret may ever be put here.
 */
export interface JwtPayload {
  email: string;
}
