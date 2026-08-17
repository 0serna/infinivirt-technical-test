import { Controller, Get } from '@nestjs/common';
import type { ClientCatalogRow } from '@support-ticketing/shared';
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
}
