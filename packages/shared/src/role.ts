/**
 * Cascading Role hierarchy: Administrator ⊃ Supervisor ⊃ Agent.
 * Higher ranks include every permission of lower ranks.
 */
export const ROLES = ['agent', 'supervisor', 'admin'] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = {
  agent: 1,
  supervisor: 2,
  admin: 3,
};

/** True when `userRole` meets or exceeds the minimum Role in the cascade. */
export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minimumRole];
}
