import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  TicketListEnvelope,
  TicketListFilters,
} from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
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
}
