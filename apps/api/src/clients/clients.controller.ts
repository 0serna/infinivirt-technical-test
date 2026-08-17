import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type {
  AdminClientRow,
  ClientCatalogRow,
  CreateClientBody,
  UpdateClientBody,
} from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { requireUser } from '../auth/require-user';
import { adminIncludeDeleted } from '../http/admin-include-deleted';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequireRole('agent')
  list(
    @Req() request: AuthenticatedRequest,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<ClientCatalogRow[] | AdminClientRow[]> {
    const user = requireUser(request);
    return this.clientsService.listCatalog(
      adminIncludeDeleted(includeDeleted, user.role),
    );
  }

  @Post()
  @RequireRole('admin')
  create(@Body() body: CreateClientBody): Promise<AdminClientRow> {
    return this.clientsService.create(body);
  }

  @Patch(':id')
  @RequireRole('admin')
  update(
    @Param('id') id: string,
    @Body() body: UpdateClientBody,
  ): Promise<AdminClientRow> {
    return this.clientsService.update(id, body);
  }

  @Delete(':id')
  @RequireRole('admin')
  softDelete(@Param('id') id: string): Promise<AdminClientRow> {
    return this.clientsService.softDelete(id);
  }

  @Post(':id/restore')
  @RequireRole('admin')
  restore(@Param('id') id: string): Promise<AdminClientRow> {
    return this.clientsService.restore(id);
  }
}
