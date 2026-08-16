import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { TicketsService, type TicketListEnvelope } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<TicketListEnvelope> {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.ticketsService.list(user);
  }
}
