import { UnauthorizedException } from '@nestjs/common';

export function requireLiveUser<T extends { deletedAt: Date | null }>(
  user: T | null,
): T {
  if (!user || user.deletedAt !== null) {
    throw new UnauthorizedException();
  }
  return user;
}
