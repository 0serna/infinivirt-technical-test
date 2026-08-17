import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ClientCatalogRow,
  CreateClientBody,
} from '@support-ticketing/shared';
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

  async create(body: CreateClientBody): Promise<ClientCatalogRow> {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name.length === 0) {
      throw new BadRequestException('Invalid name');
    }

    try {
      return await this.prisma.client.create({
        data: { name },
        select: { id: true, name: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException();
      }
      throw error;
    }
  }
}
