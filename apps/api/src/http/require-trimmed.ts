import { BadRequestException } from '@nestjs/common';

export function requireTrimmed(value: unknown, field: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length === 0) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return trimmed;
}
