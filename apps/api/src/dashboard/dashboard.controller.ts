import { Controller, Get, Req } from '@nestjs/common';
import type { DashboardEnvelope } from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { requireUser } from '../auth/require-user';
import { DashboardService } from './dashboard.service';

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
