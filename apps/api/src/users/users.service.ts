import { Injectable } from '@nestjs/common';
import type { UserCatalogRow } from '@support-ticketing/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(): Promise<UserCatalogRow[]> {
    return this.prisma.user.findMany({
      select: { id: true, displayName: true, role: true },
      orderBy: { displayName: 'asc' },
    });
  }
}
