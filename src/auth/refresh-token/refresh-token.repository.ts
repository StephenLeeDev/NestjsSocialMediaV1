/**
 * ============================================================================
 *  RefreshTokenRepository: database access for refresh tokens
 * ============================================================================
 *
 * Responsibility: queries only. The rules (rotation, reuse detection, expiry)
 * are in AuthService.
 *
 * The important method is `revokeIfActive`: "mark this token as used, but
 * only if nobody has done so yet" in ONE statement. When several requests
 * present the same token at the same moment, exactly one of them gets `true`
 * and may issue new tokens; the others get `false`.
 */
import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

/** The values needed to store a newly issued refresh token. */
export interface NewRefreshToken {
  userEmail: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenRepository extends Repository<RefreshToken> {
  constructor(dataSource: DataSource) {
    super(RefreshToken, dataSource.createEntityManager());
  }

  /** Stores a newly issued token (its hash). */
  async insertToken(token: NewRefreshToken): Promise<void> {
    await this.insert({ ...token, createdAt: new Date(), revokedAt: null });
  }

  /** The token with this hash, or `null` if no such token was ever issued. */
  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.findOneBy({ tokenHash });
  }

  /**
   * Revokes the token if it is still active.
   *
   *   UPDATE refresh_token SET "revokedAt" = now()
   *   WHERE id = :id AND "revokedAt" IS NULL
   *
   * The database applies UPDATEs to the same row one after another, and the
   * second one no longer matches `"revokedAt" IS NULL`. So among parallel
   * calls for the same token exactly one returns `true`.
   *
   * @returns `true` if THIS call revoked it, `false` if it already was.
   */
  async revokeIfActive(id: string): Promise<boolean> {
    const result = await this.update(
      { id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  /** Revokes every still-active token of a session (family). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
