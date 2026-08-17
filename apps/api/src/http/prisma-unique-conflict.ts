import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwUniqueConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException();
  }
  throw error;
}
