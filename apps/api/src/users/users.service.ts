import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Role as PrismaRole } from '@prisma/client';
import {
  ROLES,
  type CreateUserBody,
  type ResetPasswordBody,
  type UpdateUserBody,
  type UserCatalogRow,
} from '@support-ticketing/shared';
import { hashPassword } from '../auth/password';
import { PrismaService } from '../prisma/prisma.service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USER_CATALOG_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  deletedAt: true,
} as const;

function toUserRow(user: {
  id: string;
  email: string;
  displayName: string;
  role: (typeof ROLES)[number];
  deletedAt: Date | null;
}): UserCatalogRow {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(options?: {
    includeDeleted?: boolean;
  }): Promise<UserCatalogRow[]> {
    const rows = await this.prisma.user.findMany({
      where: options?.includeDeleted ? undefined : { deletedAt: null },
      select: USER_CATALOG_SELECT,
      orderBy: { displayName: 'asc' },
    });
    return rows.map(toUserRow);
  }

  async create(body: CreateUserBody): Promise<UserCatalogRow> {
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const displayName =
      typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const password =
      typeof body?.password === 'string' ? body.password.trim() : '';
    const role = body?.role;

    if (email.length === 0) {
      throw new BadRequestException('Invalid email');
    }
    if (displayName.length === 0) {
      throw new BadRequestException('Invalid displayName');
    }
    if (password.length === 0) {
      throw new BadRequestException('Invalid password');
    }
    if (!isRole(role)) {
      throw new BadRequestException('Invalid role');
    }

    const passwordHash = await hashPassword(password);

    try {
      const created = await this.prisma.user.create({
        data: {
          email,
          displayName,
          role: role as PrismaRole,
          passwordHash,
        },
        select: USER_CATALOG_SELECT,
      });
      return toUserRow(created);
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

  async update(id: string, body: UpdateUserBody): Promise<UserCatalogRow> {
    const userId = requireUuid(id, 'id');
    if (body !== null && typeof body === 'object' && 'email' in body) {
      throw new BadRequestException('Email cannot be changed');
    }

    const raw = body ?? {};
    const hasDisplayName = 'displayName' in raw;
    const hasRole = 'role' in raw;
    if (!hasDisplayName && !hasRole) {
      throw new BadRequestException('No updatable fields');
    }

    let displayName: string | undefined;
    if (hasDisplayName) {
      displayName =
        typeof raw.displayName === 'string' ? raw.displayName.trim() : '';
      if (displayName.length === 0) {
        throw new BadRequestException('Invalid displayName');
      }
    }

    let role: (typeof ROLES)[number] | undefined;
    if (hasRole) {
      if (!isRole(raw.role)) {
        throw new BadRequestException('Invalid role');
      }
      role = raw.role;
    }

    const existing = await this.requireUser(userId);
    if (existing.deletedAt !== null) {
      throw new ConflictException();
    }

    if (role !== undefined && existing.role === 'admin' && role !== 'admin') {
      const adminCount = await this.prisma.user.count({
        where: { role: 'admin', deletedAt: null },
      });
      if (adminCount <= 1) {
        throw new ConflictException();
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(role !== undefined ? { role: role as PrismaRole } : {}),
      },
      select: USER_CATALOG_SELECT,
    });
    return toUserRow(updated);
  }

  async resetPassword(
    id: string,
    body: ResetPasswordBody,
  ): Promise<UserCatalogRow> {
    const userId = requireUuid(id, 'id');
    const password =
      typeof body?.password === 'string' ? body.password.trim() : '';
    if (password.length === 0) {
      throw new BadRequestException('Invalid password');
    }

    const existing = await this.requireUser(userId);
    if (existing.deletedAt !== null) {
      throw new ConflictException();
    }

    const passwordHash = await hashPassword(password);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: USER_CATALOG_SELECT,
    });
    return toUserRow(updated);
  }

  async softDelete(id: string, actorId: string): Promise<UserCatalogRow> {
    const userId = requireUuid(id, 'id');
    const existing = await this.requireUser(userId);

    if (userId === actorId) {
      throw new ConflictException();
    }

    if (existing.role === 'admin' && existing.deletedAt === null) {
      const adminCount = await this.prisma.user.count({
        where: { role: 'admin', deletedAt: null },
      });
      if (adminCount <= 1) {
        throw new ConflictException();
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
      select: USER_CATALOG_SELECT,
    });
    return toUserRow(updated);
  }

  async restore(id: string): Promise<UserCatalogRow> {
    const userId = requireUuid(id, 'id');
    const existing = await this.requireUser(userId);
    if (existing.deletedAt === null) {
      return toUserRow(existing);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
      select: USER_CATALOG_SELECT,
    });
    return toUserRow(updated);
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_CATALOG_SELECT,
    });
    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }
}

function requireUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value;
}

function isRole(value: unknown): value is (typeof ROLES)[number] {
  return (
    typeof value === 'string' && (ROLES as readonly string[]).includes(value)
  );
}
