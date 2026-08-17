import { UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';
import type { PublicUser } from './public-user';

export function requireUser(request: AuthenticatedRequest): PublicUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedException();
  }
  return user;
}
