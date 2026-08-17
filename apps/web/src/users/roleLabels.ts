import type { Role } from '@support-ticketing/shared';

export const ROLE_LABEL: Record<Role, string> = {
  agent: 'Agent',
  supervisor: 'Supervisor',
  admin: 'Administrator',
};

export const ROLE_COLOR: Record<Role, string> = {
  agent: 'blue',
  supervisor: 'violet',
  admin: 'indigo',
};
