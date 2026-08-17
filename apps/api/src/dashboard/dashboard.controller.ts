import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { DashboardEnvelope } from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import type { PublicUser } from '../auth/public-user';
import { RequireRole } from '../auth/require-role.decorator';
import { DashboardService } from './dashboard.service';

function requireUser(request: AuthenticatedRequest): PublicUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedException();
  }
  return user;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequireRole('agent')
  getOperational(
    @Req() request: AuthenticatedRequest,
  ): Promise<DashboardEnvelope> {
    return this.dashboardService.getOperational(requireUser(request));
  }
}
