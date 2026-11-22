/**
 * The sign-in providers the server supports.
 *
 * Stored in `user.socialType` when an account is created, and compared on
 * every later sign-in: an email registered with one provider cannot sign in
 * through another (409 Conflict, see AuthService.signIn).
 *
 * The values are the exact strings the Flutter app sends ("GOOGLE"), and
 * `AuthCredentialsDto` rejects anything else with 400 Bad Request.
 *
 * (This file used to be called `auth-social-type-validation.enum.ts`, and an
 * `AuthSocialTypeValidationPipe` existed next to it. That pipe was never
 * used anywhere; the DTO's `@IsEnum` check does the same job now.)
 */
export enum AuthSocialType {
  GOOGLE = 'GOOGLE',
}
