/**
 * ============================================================================
 *  RefreshTokenService unit tests
 * ============================================================================
 *
 * The service is built with a FAKE repository, so each rule can be tested on
 * its own, including the case the e2e tests cannot reproduce reliably: a
 * parallel request revoking the token first ("revokeIfActive" → false).
 *
 * Run with: npm test
 */
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from './refresh-token.entity';
import { RefreshTokenRepository } from './refresh-token.repository';
import { hashToken, RefreshTokenService } from './refresh-token.service';

const EMAIL = 'john@gmail.com';
const FAMILY = '11111111-1111-4111-8111-111111111111';
const DAY_MS = 24 * 60 * 60 * 1000;

/** A stored token row; pass `overrides` to change only what a test needs. */
function storedToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'row-1',
    userEmail: EMAIL,
    familyId: FAMILY,
    tokenHash: hashToken('the-token'),
    expiresAt: new Date(Date.now() + DAY_MS),
    createdAt: new Date(),
    revokedAt: null,
    ...overrides,
  } as RefreshToken;
}

describe('RefreshTokenService', () => {
  let repository: {
    insertToken: jest.Mock;
    findByHash: jest.Mock;
    revokeIfActive: jest.Mock;
    revokeFamily: jest.Mock;
  };
  let service: RefreshTokenService;

  // Rejections are logged as warnings; keep the test output clean.
  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(true));

  beforeEach(() => {
    repository = {
      insertToken: jest.fn(),
      findByHash: jest.fn().mockResolvedValue(storedToken()),
      revokeIfActive: jest.fn().mockResolvedValue(true),
      revokeFamily: jest.fn(),
    };
    // No JWT_REFRESH_EXPIRES_IN_SECONDS set → the 30-day default is used.
    const config = {
      get: jest.fn((_key: string, fallback: string) => fallback),
    };
    service = new RefreshTokenService(
      repository as unknown as RefreshTokenRepository,
      config as unknown as ConfigService,
    );
  });

  describe('issue', () => {
    it('returns a random token and stores only its hash, valid for 30 days', async () => {
      const token = await service.issue(EMAIL);

      // 32 random bytes in base64url = 43 characters, no dots.
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const stored = repository.insertToken.mock.calls[0][0];
      expect(stored.userEmail).toBe(EMAIL);
      expect(stored.tokenHash).toBe(hashToken(token));
      expect(stored.tokenHash).not.toBe(token);
      const lifetime = stored.expiresAt.getTime() - Date.now();
      expect(lifetime).toBeGreaterThan(29.9 * DAY_MS);
      expect(lifetime).toBeLessThanOrEqual(30 * DAY_MS);
    });

    it('starts a new session on sign-in, or continues the given one', async () => {
      await service.issue(EMAIL);
      await service.issue(EMAIL);
      await service.issue(EMAIL, FAMILY);

      const families = repository.insertToken.mock.calls.map(
        ([row]) => row.familyId,
      );
      expect(families[0]).not.toBe(families[1]); // two sign-ins, two sessions
      expect(families[2]).toBe(FAMILY); // a rotation stays in its session
    });

    it('never returns the same token twice', async () => {
      const tokens = await Promise.all(
        Array.from({ length: 20 }, () => service.issue(EMAIL)),
      );
      expect(new Set(tokens).size).toBe(20);
    });
  });

  describe('rotate', () => {
    it('revokes the used token and issues a replacement in the same session', async () => {
      const result = await service.rotate('the-token');

      expect(repository.findByHash).toHaveBeenCalledWith(
        hashToken('the-token'),
      );
      expect(repository.revokeIfActive).toHaveBeenCalledWith('row-1');
      expect(result.userEmail).toBe(EMAIL);
      expect(repository.insertToken).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: EMAIL, familyId: FAMILY }),
      );
      expect(repository.revokeFamily).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      repository.findByHash.mockResolvedValue(null);

      await expect(service.rotate('nope')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repository.insertToken).not.toHaveBeenCalled();
    });

    it('ends the session when a revoked token is presented again', async () => {
      repository.findByHash.mockResolvedValue(
        storedToken({ revokedAt: new Date() }),
      );

      await expect(service.rotate('the-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repository.revokeFamily).toHaveBeenCalledWith(FAMILY);
      expect(repository.insertToken).not.toHaveBeenCalled();
    });

    it('rejects an expired token without issuing a new one', async () => {
      repository.findByHash.mockResolvedValue(
        storedToken({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.rotate('the-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repository.revokeIfActive).not.toHaveBeenCalled();
      expect(repository.insertToken).not.toHaveBeenCalled();
    });

    it('treats losing the race to a parallel request as reuse', async () => {
      // Both requests saw an active token, but the other one revoked it first.
      repository.revokeIfActive.mockResolvedValue(false);

      await expect(service.rotate('the-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repository.revokeFamily).toHaveBeenCalledWith(FAMILY);
      expect(repository.insertToken).not.toHaveBeenCalled();
    });
  });

  describe('revokeSession', () => {
    it('revokes the whole session of a known token', async () => {
      await service.revokeSession('the-token');
      expect(repository.revokeFamily).toHaveBeenCalledWith(FAMILY);
    });

    it('does nothing for an unknown token', async () => {
      repository.findByHash.mockResolvedValue(null);
      await service.revokeSession('nope');
      expect(repository.revokeFamily).not.toHaveBeenCalled();
    });
  });
});
