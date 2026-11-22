/**
 * ============================================================================
 *  RefreshToken: one issued refresh token (table "refresh_token")
 * ============================================================================
 *
 * ACCESS TOKEN vs REFRESH TOKEN
 *   access token  a JWT sent with EVERY request. Checked without a database
 *                 lookup (only the signature), so it cannot be revoked; it is
 *                 meant to expire soon.
 *   refresh token a random string sent ONLY to POST /auth/refresh, where it
 *                 is exchanged for a new pair. It lives long (default 30
 *                 days), and because every use is checked against THIS table,
 *                 it can be revoked at any time (logout, theft).
 *
 * ROTATION AND "FAMILIES"
 *   Every refresh replaces the used token with a new one: the old row gets
 *   `revokedAt`, a new row is inserted. All tokens that descend from the same
 *   sign-in share a `familyId`; one family = one session on one device.
 *
 *     sign-in ─▶ token A ─refresh─▶ token B ─refresh─▶ token C   (family F)
 *                (revoked)          (revoked)          (active)
 *
 *   If a REVOKED token is presented again, someone kept a copy of it (only
 *   the newest token should still be in use). The server cannot tell the real
 *   user from the thief, so the whole family is revoked and both must sign in
 *   again. Other sessions of the same user (other families) are not touched.
 *
 * WHAT IS STORED
 *   Only the SHA-256 hash of the token, never the token itself, in the same
 *   way passwords are stored as hashes: a leaked database or backup does not
 *   contain working tokens. (SHA-256 without salt is enough here, unlike for
 *   passwords, because the tokens are long random values that cannot be
 *   guessed or looked up in a dictionary.)
 *
 * TIME ZONE NOTE
 *   Unlike the older tables (which store Seoul local time without a time
 *   zone, see common/utils/date.util.ts), these columns are `timestamptz`
 *   with real instants (`new Date()`), because expiry is security relevant
 *   and is compared with the database clock (`now()`). This is also the
 *   direction planned for the other tables.
 */
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';

@Entity('refresh_token')
export class RefreshToken {
  // A random UUID as the row id (not the token, not guessable either way).
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Whose session this is. Deleting the user deletes their tokens.
  @Column({ type: 'varchar' })
  userEmail: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userEmail', referencedColumnName: 'email' })
  user?: User;

  // All tokens of one sign-in session share this id (see "families" above).
  // Indexed for "revoke the whole family".
  @Column({ type: 'uuid' })
  @Index()
  familyId: string;

  // SHA-256 of the token, as 64 hex characters. UNIQUE: lookups by hash use
  // its index, and two rows can never claim the same token.
  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  // After this instant the token is rejected.
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  // Set when the token was used (rotated), logged out or revoked with its
  // family. `null` = still active.
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
