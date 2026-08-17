import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdminClientRow,
  ClientCatalogRow,
  CreateClientBody,
  UpdateClientBody,
} from '@support-ticketing/shared';
import { requireTrimmed } from '../http/require-trimmed';
import { requireUuid } from '../http/require-uuid';
import { PrismaService } from '../prisma/prisma.service';

const clientSelect = {
  id: true,
  name: true,
  deletedAt: true,
} as const;

type ClientRecord = {
  id: string;
  name: string;
  deletedAt: Date | null;
};

function toCatalogRow(client: ClientRecord): ClientCatalogRow {
  return { id: client.id, name: client.name };
}

function toAdminRow(client: ClientRecord): AdminClientRow {
  return {
    ...toCatalogRow(client),
    deletedAt: client.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(
    includeDeleted = false,
  ): Promise<ClientCatalogRow[] | AdminClientRow[]> {
    const rows = await this.prisma.client.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      select: clientSelect,
      orderBy: { name: 'asc' },
    });
    return includeDeleted ? rows.map(toAdminRow) : rows.map(toCatalogRow);
  }

  async create(body: CreateClientBody): Promise<AdminClientRow> {
    const name = requireTrimmed(body?.name, 'name');

    const created = await this.prisma.client.create({
      data: { name },
      select: clientSelect,
    });
    return toAdminRow(created);
  }

  async update(id: string, body: UpdateClientBody): Promise<AdminClientRow> {
    const clientId = requireUuid(id, 'id');
    const name = requireTrimmed(body?.name, 'name');
    const existing = await this.requireClient(clientId);
    if (existing.deletedAt !== null) {
      throw new ConflictException();
    }

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { name },
      select: clientSelect,
    });
    return toAdminRow(updated);
  }

  async softDelete(id: string): Promise<AdminClientRow> {
    const clientId = requireUuid(id, 'id');
    await this.requireClient(clientId);

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
      select: clientSelect,
    });
    return toAdminRow(updated);
  }

  async restore(id: string): Promise<AdminClientRow> {
    const clientId = requireUuid(id, 'id');
    const existing = await this.requireClient(clientId);
    if (existing.deletedAt === null) {
      return toAdminRow(existing);
    }

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: null },
      select: clientSelect,
    });
    return toAdminRow(updated);
  }

  private async requireClient(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: clientSelect,
    });
    if (!client) {
      throw new NotFoundException();
    }
    return client;
  }
}
