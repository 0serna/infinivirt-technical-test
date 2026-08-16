import type { Role } from '@support-ticketing/shared';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};
