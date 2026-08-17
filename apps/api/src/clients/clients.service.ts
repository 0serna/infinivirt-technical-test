import {
  BadRequestException,
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
import { throwUniqueConflict } from '../http/prisma-unique-conflict';
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

function requireName(body: { name?: unknown }): string {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length === 0) {
    throw new BadRequestException('Invalid name');
  }
  return name;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(options?: {
    includeDeleted?: boolean;
  }): Promise<ClientCatalogRow[] | AdminClientRow[]> {
    const rows = await this.prisma.client.findMany({
      where: options?.includeDeleted ? undefined : { deletedAt: null },
      select: clientSelect,
      orderBy: { name: 'asc' },
    });
    return options?.includeDeleted
      ? rows.map(toAdminRow)
      : rows.map(toCatalogRow);
  }

  async create(body: CreateClientBody): Promise<AdminClientRow> {
    const name = requireName(body);

    try {
      const created = await this.prisma.client.create({
        data: { name },
        select: clientSelect,
      });
      return toAdminRow(created);
    } catch (error) {
      throwUniqueConflict(error);
    }
  }

  async update(id: string, body: UpdateClientBody): Promise<AdminClientRow> {
    const clientId = requireUuid(id, 'id');
    const name = requireName(body);
    const existing = await this.requireClient(clientId);
    if (existing.deletedAt !== null) {
      throw new ConflictException();
    }

    try {
      const updated = await this.prisma.client.update({
        where: { id: clientId },
        data: { name },
        select: clientSelect,
      });
      return toAdminRow(updated);
    } catch (error) {
      throwUniqueConflict(error);
    }
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
