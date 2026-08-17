import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type Role as PrismaRole } from '@prisma/client';
import {
  ROLES,
  type CreateUserBody,
  type UserCatalogRow,
} from '@support-ticketing/shared';
import { hashPassword } from '../auth/password';
import { PrismaService } from '../prisma/prisma.service';

const USER_CATALOG_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(): Promise<UserCatalogRow[]> {
    return this.prisma.user.findMany({
      select: USER_CATALOG_SELECT,
      orderBy: { displayName: 'asc' },
    });
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
      return await this.prisma.user.create({
        data: {
          email,
          displayName,
          role: role as PrismaRole,
          passwordHash,
        },
        select: USER_CATALOG_SELECT,
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

function isRole(value: unknown): value is (typeof ROLES)[number] {
  return (
    typeof value === 'string' && (ROLES as readonly string[]).includes(value)
  );
}
