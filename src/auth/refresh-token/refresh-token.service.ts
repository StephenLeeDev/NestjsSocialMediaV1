/**
 * ============================================================================
 *  RefreshTokenService: issuing, rotating and revoking refresh tokens
 * ============================================================================
 *
 *   AuthService            → sign-in / refresh / logout use cases
 *        │                   (also creates the ACCESS tokens)
 *   RefreshTokenService    → the refresh token rules (THIS FILE)
 *        │                   - a token is a random value; only its hash is stored
 *        │                   - every use replaces it (rotation)
 *        │                   - using a replaced token ends its session
 *        │                   - expired tokens are rejected
 *        │
 *   RefreshTokenRepository → queries only
 *
 * See refresh-token.entity.ts for the concepts (families, rotation, why only
 * hashes are stored).
 *
 * Every rejection is the same 401 with the same message, whatever the reason
 * (unknown, expired, reused). A client cannot do anything different in those
 * cases (it has to sign in again), and an attacker learns nothing from the
 * answer. The real reason is logged for the server operator.
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { RefreshTokenRepository } from './refresh-token.repository';

/** Default refresh token lifetime: 30 days (JWT_REFRESH_EXPIRES_IN_SECONDS). */
const DEFAULT_REFRESH_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;

/** What a successful rotation hands back to AuthService. */
export interface RotatedRefreshToken {
  /** Whose session it is (the new access token is issued for this user). */
  userEmail: string;
  /** The new refresh token that replaces the used one. */
  refreshToken: string;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly lifetimeMs: number;

  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    configService: ConfigService,
  ) {
    this.lifetimeMs =
      Number(
        configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN_SECONDS',
          String(DEFAULT_REFRESH_EXPIRES_IN_SECONDS),
        ),
      ) * 1000;
  }

  /**
   * Issues a new refresh token for `userEmail` and stores its hash.
   *
   * @param familyId The session the token belongs to. Omitted on sign-in,
   *                 which starts a NEW session; passed on rotation, which
   *                 continues the existing one.
   * @returns The token itself. It exists only in this response: the
   *          database keeps just its hash, so it cannot be shown again.
   */
  async issue(
    userEmail: string,
    familyId: string = randomUUID(),
  ): Promise<string> {
    // 32 random bytes = 256 bits: impossible to guess. base64url keeps the
    // token safe to put in JSON, headers or URLs ("A-Z a-z 0-9 - _", no dots,
    // so it can never be mistaken for a JWT).
    const token = randomBytes(32).toString('base64url');

    await this.refreshTokenRepository.insertToken({
      userEmail,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + this.lifetimeMs),
    });
    return token;
  }

  /**
   * Uses a refresh token: revokes it and issues its replacement in the same
   * session.
   *
   * Order of checks:
   *   1. unknown token                          → 401
   *   2. already revoked → REUSE: revoke the session, then 401
   *   3. expired                                → 401
   *   4. revoke it; if a parallel request was faster, treat it like 2.
   *   5. issue the replacement
   *
   * @throws UnauthorizedException (401) in every rejected case.
   */
  async rotate(token: string): Promise<RotatedRefreshToken> {
    const stored = await this.refreshTokenRepository.findByHash(
      hashToken(token),
    );
    if (!stored) {
      throw this.rejected('unknown refresh token');
    }

    if (stored.revokedAt !== null) {
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
      throw this.rejected(
        `reused refresh token of ${stored.userEmail}; session ${stored.familyId} revoked`,
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw this.rejected(`expired refresh token of ${stored.userEmail}`);
    }

    // "Revoke if still active" is atomic: of several simultaneous requests
    // with this token, only one passes. The others count as reuse, exactly
    // like a later replay would.
    const won = await this.refreshTokenRepository.revokeIfActive(stored.id);
    if (!won) {
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
      throw this.rejected(
        `concurrent reuse of a refresh token of ${stored.userEmail}; session ${stored.familyId} revoked`,
      );
    }

    return {
      userEmail: stored.userEmail,
      refreshToken: await this.issue(stored.userEmail, stored.familyId),
    };
  }

  /**
   * Ends the session the token belongs to (logout). Unknown tokens are
   * ignored: the result ("this token no longer works") is the same.
   */
  async revokeSession(token: string): Promise<void> {
    const stored = await this.refreshTokenRepository.findByHash(
      hashToken(token),
    );
    if (stored) {
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
    }
  }

  /** Logs the real reason, answers with one generic 401. */
  private rejected(reason: string): UnauthorizedException {
    this.logger.warn(`Refresh rejected: ${reason}`);
    return new UnauthorizedException('Invalid refresh token');
  }
}

/** SHA-256 of the token as 64 hex characters (what the database stores). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
