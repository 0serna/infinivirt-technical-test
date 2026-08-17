import { hasMinimumRole, type Role } from './role';

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export type Priority = (typeof PRIORITIES)[number];

/** Query value for Assignee null. Not a User id. */
export const UNASSIGNED_ASSIGNEE_QUERY = 'unassigned';

export type TicketListPerson = {
  id: string;
  displayName: string;
};

export type TicketListClient = {
  id: string;
  name: string;
};

export type TicketListRow = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  client: TicketListClient;
  assignee: TicketListPerson | null;
  createdBy: TicketListPerson;
  updatedAt: string;
  createdAt: string;
};

export type TicketListFilters = {
  status?: string;
  priority?: string;
  clientId?: string;
  assigneeId?: string;
};

export type TicketListFilterOptions = {
  clients: TicketListClient[];
  assignees: TicketListPerson[];
  includeUnassigned: boolean;
};

export type TicketListEnvelope = {
  tickets: TicketListRow[];
  filterOptions: TicketListFilterOptions;
};

export type TicketStatusHistoryRow = {
  from: TicketStatus | null;
  to: TicketStatus;
  changedAt: string;
  changedBy: TicketListPerson;
};

export type TicketDetail = TicketListRow & {
  description: string;
  resolvedAt: string | null;
  closedAt: string | null;
  statusHistory: TicketStatusHistoryRow[];
};

/** Actor names only `to`. `from` is always the current Status. */
export type PatchTicketStatusBody = {
  status: TicketStatus;
};

/** Next Status on the single graph, including reopen (`closed` → `open`). */
export const NEXT_TICKET_STATUS: Record<TicketStatus, TicketStatus | null> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
  closed: 'open',
};

export function isLegalStatusEdge(
  from: TicketStatus,
  to: TicketStatus,
): boolean {
  return NEXT_TICKET_STATUS[from] === to;
}

/**
 * Next forward Status this User may record on the detail screen.
 * Close (`resolved` → `closed`) and reopen are not offered here.
 */
export function nextRecordableForwardStatus(args: {
  status: TicketStatus;
  role: Role;
  actorId: string;
  assigneeId: string | null;
}): TicketStatus | null {
  const next = NEXT_TICKET_STATUS[args.status];
  if (next !== 'in_progress' && next !== 'resolved') {
    return null;
  }
  if (hasMinimumRole(args.role, 'admin')) {
    return next;
  }
  if (args.assigneeId === args.actorId) {
    return next;
  }
  return null;
}

export const EMPTY_TICKET_LIST_FILTER_OPTIONS: TicketListFilterOptions = {
  clients: [],
  assignees: [],
  includeUnassigned: false,
};
