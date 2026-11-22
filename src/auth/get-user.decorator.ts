import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { User } from '../user/user.entity';

/**
 * Parameter decorator that gives a controller method the signed-in user:
 *
 *   @UseGuards(AuthGuard())
 *   @Get()
 *   getMyProfile(@GetUser() user: User) { ... }
 *
 * The user was loaded by JwtStrategy.validate and stored on the request as
 * `request.user` by Passport.
 *
 * Only use it on routes protected by `AuthGuard()`. Without the guard
 * nobody fills `request.user`, and the parameter would be `undefined`.
 */
export const GetUser = createParamDecorator(
  // The first argument would be the value passed as `@GetUser(value)`;
  // this decorator does not take one.
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as User;
  },
);
