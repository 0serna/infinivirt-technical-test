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
  TicketDetail,
  TicketListEnvelope,
  TicketListFilters,
} from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { requireUser } from '../auth/require-user';
import { IdParamDto } from '../http/dto/id-param.dto';
import {
  CreateTicketCommentDto,
  CreateTicketDto,
  PatchTicketAssigneeDto,
  PatchTicketFieldsDto,
  PatchTicketStatusDto,
} from '../http/dto/ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@RequireRole('agent')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: TicketListFilters,
  ): Promise<TicketListEnvelope> {
    return this.ticketsService.list(requireUser(request), query);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateTicketDto,
  ): Promise<TicketDetail> {
    return this.ticketsService.create(requireUser(request), body);
  }

  @Get(':id')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
  ): Promise<TicketDetail> {
    return this.ticketsService.getById(requireUser(request), params.id);
  }

  @Post(':id/comments')
  createComment(
    @Req() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
    @Body() body: CreateTicketCommentDto,
  ): Promise<TicketDetail> {
    return this.ticketsService.createComment(
      requireUser(request),
      params.id,
      body,
    );
  }

  @Patch(':id/assignee')
  recordReassignment(
    @Req() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
    @Body() body: PatchTicketAssigneeDto,
  ): Promise<TicketDetail> {
    return this.ticketsService.recordReassignment(
      requireUser(request),
      params.id,
      body,
    );
  }

  @Patch(':id/fields')
  recordFieldEdit(
    @Req() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
    @Body() body: PatchTicketFieldsDto,
  ): Promise<TicketDetail> {
    return this.ticketsService.recordFieldEdit(
      requireUser(request),
      params.id,
      body,
    );
  }

  @Patch(':id')
  recordStatusTransition(
    @Req() request: AuthenticatedRequest,
    @Param() params: IdParamDto,
    @Body() body: PatchTicketStatusDto,
  ): Promise<TicketDetail> {
    return this.ticketsService.recordStatusTransition(
      requireUser(request),
      params.id,
      body,
    );
  }
}
