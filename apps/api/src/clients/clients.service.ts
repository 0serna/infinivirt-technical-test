import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ClientCatalogRow,
  CreateClientBody,
  UpdateClientBody,
} from '@support-ticketing/shared';
import { PrismaService } from '../prisma/prisma.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const clientSelect = {
  id: true,
  name: true,
  deletedAt: true,
} as const;

function toClientRow(client: {
  id: string;
  name: string;
  deletedAt: Date | null;
}): ClientCatalogRow {
  return {
    id: client.id,
    name: client.name,
    deletedAt: client.deletedAt?.toISOString() ?? null,
  };
}

function requireUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value;
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
  }): Promise<ClientCatalogRow[]> {
    const rows = await this.prisma.client.findMany({
      where: options?.includeDeleted ? undefined : { deletedAt: null },
      select: clientSelect,
      orderBy: { name: 'asc' },
    });
    return rows.map(toClientRow);
  }

  async create(body: CreateClientBody): Promise<ClientCatalogRow> {
    const name = requireName(body);

    try {
      const created = await this.prisma.client.create({
        data: { name },
        select: clientSelect,
      });
      return toClientRow(created);
    } catch (error) {
      throw mapUniqueConflict(error);
    }
  }

  async update(id: string, body: UpdateClientBody): Promise<ClientCatalogRow> {
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
      return toClientRow(updated);
    } catch (error) {
      throw mapUniqueConflict(error);
    }
  }

  async softDelete(id: string): Promise<ClientCatalogRow> {
    const clientId = requireUuid(id, 'id');
    await this.requireClient(clientId);

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
      select: clientSelect,
    });
    return toClientRow(updated);
  }

  async restore(id: string): Promise<ClientCatalogRow> {
    const clientId = requireUuid(id, 'id');
    const existing = await this.requireClient(clientId);
    if (existing.deletedAt === null) {
      return toClientRow(existing);
    }

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: null },
      select: clientSelect,
    });
    return toClientRow(updated);
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

function mapUniqueConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException();
  }
  throw error;
}
