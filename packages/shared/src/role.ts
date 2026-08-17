/** Cascading Role hierarchy: Administrator ⊃ Supervisor ⊃ Agent. */
export const ROLES = ['agent', 'supervisor', 'admin'] as const;

export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = {
  agent: 1,
  supervisor: 2,
  admin: 3,
};

export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minimumRole];
}
