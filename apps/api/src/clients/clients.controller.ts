import { Body, Controller, Get, Post } from '@nestjs/common';
import type {
  ClientCatalogRow,
  CreateClientBody,
} from '@support-ticketing/shared';
import { RequireRole } from '../auth/require-role.decorator';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequireRole('agent')
  list(): Promise<ClientCatalogRow[]> {
    return this.clientsService.listCatalog();
  }

  @Post()
  @RequireRole('admin')
  create(@Body() body: CreateClientBody): Promise<ClientCatalogRow> {
    return this.clientsService.create(body);
  }
}
