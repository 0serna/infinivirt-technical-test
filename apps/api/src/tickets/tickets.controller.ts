import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  CreateTicketCommentBody,
  PatchTicketStatusBody,
  TicketDetail,
  TicketListEnvelope,
  TicketListFilters,
} from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import type { PublicUser } from '../auth/public-user';
import { RequireRole } from '../auth/require-role.decorator';
import { TicketsService } from './tickets.service';

function requireUser(request: AuthenticatedRequest): PublicUser {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedException();
  }
  return user;
}

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @RequireRole('agent')
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: TicketListFilters,
  ): Promise<TicketListEnvelope> {
    return this.ticketsService.list(requireUser(request), query);
  }

  @Get(':id')
  @RequireRole('agent')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<TicketDetail> {
    return this.ticketsService.getById(requireUser(request), id);
  }

  @Post(':id/comments')
  @RequireRole('agent')
  createComment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: CreateTicketCommentBody,
  ): Promise<TicketDetail> {
    return this.ticketsService.createComment(requireUser(request), id, body);
  }

  @Patch(':id')
  @RequireRole('agent')
  recordStatusTransition(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: PatchTicketStatusBody,
  ): Promise<TicketDetail> {
    return this.ticketsService.recordStatusTransition(
      requireUser(request),
      id,
      body,
    );
  }
}
