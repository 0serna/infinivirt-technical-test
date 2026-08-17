import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type {
  CreateTicketBody,
  CreateTicketCommentBody,
  PatchTicketAssigneeBody,
  PatchTicketStatusBody,
  TicketDetail,
  TicketListEnvelope,
  TicketListFilters,
} from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { requireUser } from '../auth/require-user';
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
    return this.ticketsService.list(requireUser(request), query);
  }

  @Post()
  @RequireRole('agent')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateTicketBody,
  ): Promise<TicketDetail> {
    return this.ticketsService.create(requireUser(request), body);
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

  @Patch(':id/assignee')
  @RequireRole('agent')
  recordReassignment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: PatchTicketAssigneeBody,
  ): Promise<TicketDetail> {
    return this.ticketsService.recordReassignment(
      requireUser(request),
      id,
      body,
    );
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
