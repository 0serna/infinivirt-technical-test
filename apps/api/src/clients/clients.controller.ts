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
  ClientCatalogRow,
  CreateClientBody,
  UpdateClientBody,
} from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { requireUser } from '../auth/require-user';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequireRole('agent')
  list(
    @Req() request: AuthenticatedRequest,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<ClientCatalogRow[]> {
    const user = requireUser(request);
    const wantsDeleted = includeDeleted === 'true' || includeDeleted === '1';
    return this.clientsService.listCatalog({
      includeDeleted: wantsDeleted && user.role === 'admin',
    });
  }

  @Post()
  @RequireRole('admin')
  create(@Body() body: CreateClientBody): Promise<ClientCatalogRow> {
    return this.clientsService.create(body);
  }

  @Patch(':id')
  @RequireRole('admin')
  update(
    @Param('id') id: string,
    @Body() body: UpdateClientBody,
  ): Promise<ClientCatalogRow> {
    return this.clientsService.update(id, body);
  }

  @Delete(':id')
  @RequireRole('admin')
  softDelete(@Param('id') id: string): Promise<ClientCatalogRow> {
    return this.clientsService.softDelete(id);
  }

  @Post(':id/restore')
  @RequireRole('admin')
  restore(@Param('id') id: string): Promise<ClientCatalogRow> {
    return this.clientsService.restore(id);
  }
}
