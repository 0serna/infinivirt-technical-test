import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role as PrismaRole } from '@prisma/client';
import {
  ROLES,
  type AdminUserRow,
  type CreateUserBody,
  type ResetPasswordBody,
  type UpdateUserBody,
  type UserCatalogRow,
} from '@support-ticketing/shared';
import { hashPassword } from '../auth/password';
import { throwUniqueConflict } from '../http/prisma-unique-conflict';
import { requireTrimmed } from '../http/require-trimmed';
import { requireUuid } from '../http/require-uuid';
import { PrismaService } from '../prisma/prisma.service';

const USER_CATALOG_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  deletedAt: true,
} as const;

type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  role: (typeof ROLES)[number];
  deletedAt: Date | null;
};

function toCatalogRow(user: UserRecord): UserCatalogRow {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

function toAdminRow(user: UserRecord): AdminUserRow {
  return {
    ...toCatalogRow(user),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(
    includeDeleted = false,
  ): Promise<UserCatalogRow[] | AdminUserRow[]> {
    const rows = await this.prisma.user.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      select: USER_CATALOG_SELECT,
      orderBy: { displayName: 'asc' },
    });
    return includeDeleted ? rows.map(toAdminRow) : rows.map(toCatalogRow);
  }

  async create(body: CreateUserBody): Promise<AdminUserRow> {
    const email = requireTrimmed(body?.email, 'email');
    const displayName = requireTrimmed(body?.displayName, 'displayName');
    const password = requireTrimmed(body?.password, 'password');
    const role = body?.role;
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
      return toAdminRow(created);
    } catch (error) {
      throwUniqueConflict(error);
    }
  }

  async update(id: string, body: UpdateUserBody): Promise<AdminUserRow> {
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
      displayName = requireTrimmed(raw.displayName, 'displayName');
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

    if (role !== undefined && role !== 'admin') {
      await this.rejectIfSoleLiveAdmin(existing);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(role !== undefined ? { role: role as PrismaRole } : {}),
      },
      select: USER_CATALOG_SELECT,
    });
    return toAdminRow(updated);
  }

  async resetPassword(
    id: string,
    body: ResetPasswordBody,
  ): Promise<AdminUserRow> {
    const userId = requireUuid(id, 'id');
    const password = requireTrimmed(body?.password, 'password');

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
    return toAdminRow(updated);
  }

  async softDelete(id: string, actorId: string): Promise<AdminUserRow> {
    const userId = requireUuid(id, 'id');
    const existing = await this.requireUser(userId);

    if (userId === actorId) {
      throw new ConflictException();
    }

    await this.rejectIfSoleLiveAdmin(existing);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
      select: USER_CATALOG_SELECT,
    });
    return toAdminRow(updated);
  }

  async restore(id: string): Promise<AdminUserRow> {
    const userId = requireUuid(id, 'id');
    const existing = await this.requireUser(userId);
    if (existing.deletedAt === null) {
      return toAdminRow(existing);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
      select: USER_CATALOG_SELECT,
    });
    return toAdminRow(updated);
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

  private async rejectIfSoleLiveAdmin(user: UserRecord): Promise<void> {
    if (user.role !== 'admin' || user.deletedAt !== null) {
      return;
    }
    const liveAdmins = await this.prisma.user.count({
      where: { role: 'admin', deletedAt: null },
    });
    if (liveAdmins <= 1) {
      throw new ConflictException();
    }
  }
}

function isRole(value: unknown): value is (typeof ROLES)[number] {
  return (
    typeof value === 'string' && (ROLES as readonly string[]).includes(value)
  );
}
