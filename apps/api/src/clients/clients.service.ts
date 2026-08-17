import { Injectable } from '@nestjs/common';
import type { ClientCatalogRow } from '@support-ticketing/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(): Promise<ClientCatalogRow[]> {
    return this.prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
