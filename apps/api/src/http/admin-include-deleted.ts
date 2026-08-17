import type { Role } from '@support-ticketing/shared';

export function adminIncludeDeleted(
  includeDeleted: string | undefined,
  role: Role,
): boolean {
  const wantsDeleted = includeDeleted === 'true' || includeDeleted === '1';
  return wantsDeleted && role === 'admin';
}
