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

export const NEXT_TICKET_STATUS: Record<TicketStatus, TicketStatus> = {
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

export function mayRecordStatusTransition(args: {
  from: TicketStatus;
  to: TicketStatus;
  role: Role;
  actorId: string;
  assigneeId: string | null;
}): boolean {
  if (!isLegalStatusEdge(args.from, args.to)) {
    return false;
  }
  if (args.to === 'closed' || args.from === 'closed') {
    return hasMinimumRole(args.role, 'admin');
  }
  return hasMinimumRole(args.role, 'admin') || args.assigneeId === args.actorId;
}

export function nextRecordableStatus(args: {
  status: TicketStatus;
  role: Role;
  actorId: string;
  assigneeId: string | null;
}): TicketStatus | null {
  const to = NEXT_TICKET_STATUS[args.status];
  return mayRecordStatusTransition({
    from: args.status,
    to,
    role: args.role,
    actorId: args.actorId,
    assigneeId: args.assigneeId,
  })
    ? to
    : null;
}

export const EMPTY_TICKET_LIST_FILTER_OPTIONS: TicketListFilterOptions = {
  clients: [],
  assignees: [],
  includeUnassigned: false,
};
