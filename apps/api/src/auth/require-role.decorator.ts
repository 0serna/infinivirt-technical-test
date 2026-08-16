import { SetMetadata } from '@nestjs/common';
import type { Role } from '@support-ticketing/shared';

export const REQUIRE_ROLE_KEY = 'requireRole';

/** Declares the minimum Role required (cascade: admin ⊃ supervisor ⊃ agent). */
export const RequireRole = (minimumRole: Role) =>
  SetMetadata(REQUIRE_ROLE_KEY, minimumRole);
