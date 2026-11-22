/**
 * ============================================================================
 *  AuthService and JwtStrategy unit tests
 * ============================================================================
 *
 * Same approach as the other service tests: the classes are built with FAKE
 * dependencies (a fake UserRepository and a fake JwtService), so only their
 * own rules are tested, without a database or real tokens.
 *
 * What the e2e tests cannot reach is covered here in particular:
 *   - the 409 "registered with another provider" rule, which the DTO makes
 *     unreachable over HTTP while GOOGLE is the only provider
 *   - "the account was created by a parallel request in the meantime"
 *
 * Run with: npm test
 */
import {
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '../user/user.entity';
import { NewUser, UserRepository } from '../user/user.repository';
import { AuthSocialType } from './auth-social-type.enum';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { JwtStrategy } from './jwt.strategy';

// ----------------------------------------------------------------------------
//  Test data helpers
// ----------------------------------------------------------------------------

const JOHN: AuthCredentialsDto = {
  username: 'John',
  socialType: AuthSocialType.GOOGLE,
  email: 'john@gmail.com',
};

/** Builds a stored user; pass `overrides` to change only what a test cares about. */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    email: JOHN.email,
    username: JOHN.username,
    socialType: AuthSocialType.GOOGLE,
    ...overrides,
  } as User;
}

/** The rows passed to the n-th `insertIfMissing` call (0-based). */
function insertedRows(mock: jest.Mock, call = 0): NewUser[] {
  return mock.mock.calls[call][0] as NewUser[];
}

// ----------------------------------------------------------------------------
//  AuthService
// ----------------------------------------------------------------------------

describe('AuthService', () => {
  let userRepository: {
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
    insertIfMissing: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };
  let service: AuthService;

  // The service logs sign-ins and conflicts; keep the test output clean.
  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(true));

  beforeEach(() => {
    userRepository = {
      // By default nobody exists yet ...
      findOneBy: jest.fn().mockResolvedValue(null),
      // ... and after the insert the row can be read back.
      findOneByOrFail: jest.fn().mockResolvedValue(makeUser()),
      insertIfMissing: jest.fn().mockResolvedValue(undefined),
    };
    // The "token" is simply the payload's email, so tests can see who it is for.
    jwtService = {
      signAsync: jest.fn(async (payload: { email: string }) => {
        return `token-for-${payload.email}`;
      }),
    };
    service = new AuthService(
      userRepository as unknown as UserRepository,
      jwtService as unknown as JwtService,
    );
  });

  describe('signIn', () => {
    it('creates the account on the first sign-in and returns a token', async () => {
      const result = await service.signIn(JOHN);

      expect(result).toEqual({ accessToken: 'token-for-john@gmail.com' });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        email: JOHN.email,
      });

      // Exactly one row with the given data and the new-account defaults.
      expect(userRepository.insertIfMissing).toHaveBeenCalledTimes(1);
      const [row] = insertedRows(userRepository.insertIfMissing);
      expect(row).toMatchObject({
        email: JOHN.email,
        username: JOHN.username,
        socialType: AuthSocialType.GOOGLE,
      });
      // Generated values: a UUID, a creation time and the default picture.
      expect(row.uuid).toMatch(/^[0-9a-f-]{36}$/);
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.thumbnail).toEqual(expect.any(String));
    });

    it('signs an existing account in without inserting anything', async () => {
      userRepository.findOneBy.mockResolvedValue(makeUser());

      const result = await service.signIn(JOHN);

      expect(result).toEqual({ accessToken: 'token-for-john@gmail.com' });
      expect(userRepository.insertIfMissing).not.toHaveBeenCalled();
    });

    it('uses the row of a parallel request that created the account first', async () => {
      // This request saw "no account", but another request inserted it in
      // the meantime: our INSERT is skipped (ON CONFLICT DO NOTHING), and the
      // row read back afterwards is the OTHER request's row.
      userRepository.findOneByOrFail.mockResolvedValue(
        makeUser({ username: 'John from the other request' }),
      );

      const result = await service.signIn(JOHN);

      expect(result).toEqual({ accessToken: 'token-for-john@gmail.com' });
      expect(userRepository.findOneByOrFail).toHaveBeenCalledWith({
        email: JOHN.email,
      });
    });

    it('rejects an email registered with another provider (409)', async () => {
      // Only reachable in unit tests for now: the DTO accepts only GOOGLE.
      userRepository.findOneBy.mockResolvedValue(
        makeUser({ socialType: 'APPLE' }),
      );

      await expect(service.signIn(JOHN)).rejects.toThrow(ConflictException);
      // No token is issued for a rejected sign-in.
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('signInAsTestUser', () => {
    it('signs in as testUser@gmail.com like a normal sign-in', async () => {
      const result = await service.signInAsTestUser();

      expect(result).toEqual({ accessToken: 'token-for-testUser@gmail.com' });
      expect(insertedRows(userRepository.insertIfMissing)[0]).toMatchObject({
        email: 'testUser@gmail.com',
        username: 'testUser',
        socialType: AuthSocialType.GOOGLE,
      });
    });
  });

  describe('createDummyUsers', () => {
    it('inserts the ten dummy users in one "insert if missing" call', async () => {
      await service.createDummyUsers();

      expect(userRepository.insertIfMissing).toHaveBeenCalledTimes(1);
      const rows = insertedRows(userRepository.insertIfMissing);
      expect(rows).toHaveLength(10);
      expect(rows[0]).toMatchObject({
        email: 'mike@gmail.com',
        username: 'Mike',
      });
      // All emails differ, so no dummy user overwrites another.
      expect(new Set(rows.map((row) => row.email)).size).toBe(10);
      // Creation times increase by 1 ms, which keeps the users in a stable order.
      expect(rows[1].createdAt.getTime() - rows[0].createdAt.getTime()).toBe(1);
    });
  });
});

// ----------------------------------------------------------------------------
//  JwtStrategy
// ----------------------------------------------------------------------------

describe('JwtStrategy', () => {
  let userRepository: { findOneBy: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    userRepository = { findOneBy: jest.fn() };
    // The constructor only needs JWT_SECRET from the configuration.
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };
    strategy = new JwtStrategy(
      userRepository as unknown as UserRepository,
      configService as unknown as ConfigService,
    );
  });

  it('returns the user the token belongs to', async () => {
    const john = makeUser();
    userRepository.findOneBy.mockResolvedValue(john);

    await expect(strategy.validate({ email: JOHN.email })).resolves.toBe(john);
    expect(userRepository.findOneBy).toHaveBeenCalledWith({
      email: JOHN.email,
    });
  });

  it('rejects a token whose user no longer exists (401)', async () => {
    userRepository.findOneBy.mockResolvedValue(null);

    await expect(
      strategy.validate({ email: 'ghost@gmail.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
