import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasMinimumRole, type Role } from '@support-ticketing/shared';
import type { AuthenticatedRequest } from './auth.guard';
import { REQUIRE_ROLE_KEY } from './require-role.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minimumRole = this.reflector.getAllAndOverride<Role | undefined>(
      REQUIRE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!minimumRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = request.user?.role;
    if (!userRole || !hasMinimumRole(userRole, minimumRole)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
