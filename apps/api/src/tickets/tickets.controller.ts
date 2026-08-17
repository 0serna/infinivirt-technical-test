import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  TicketDetail,
  TicketListEnvelope,
  TicketListFilters,
} from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @RequireRole('agent')
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: TicketListFilters,
  ): Promise<TicketListEnvelope> {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.ticketsService.list(user, query);
  }

  @Get(':id')
  @RequireRole('agent')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<TicketDetail> {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.ticketsService.getById(user, id);
  }
}
