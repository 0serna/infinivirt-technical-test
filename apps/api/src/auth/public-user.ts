import type { Role } from '@support-ticketing/shared';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

export function toPublicUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role as Role,
  };
}
