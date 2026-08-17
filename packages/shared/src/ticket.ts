import { hasMinimumRole, type Role } from './role';

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Open Ticket load (not resolved/closed). */
export const OPEN_TICKET_STATUSES = ['open', 'in_progress'] as const;

export type OpenTicketStatus = (typeof OPEN_TICKET_STATUSES)[number];

/** Prefer this over inventing a separate list endpoint for dashboard deep-links. */
export const OPEN_TICKET_LOAD_STATUS_QUERY = 'open,in_progress';

export const TICKET_LIST_STALE_QUERY = '1';

/** Open Tickets where Assignee is the current User. */
export const TICKET_LIST_ASSIGNED_OPEN_SCOPE = 'assignedOpen';

/** ADR 0011. */
export const STALE_TICKET_MAX_AGE_HOURS = 48;

export function staleTicketCutoff(nowMs = Date.now()): Date {
  return new Date(nowMs - STALE_TICKET_MAX_AGE_HOURS * 60 * 60 * 1000);
}

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export type Priority = (typeof PRIORITIES)[number];

/** Not a User id. */
export const UNASSIGNED_ASSIGNEE_QUERY = 'unassigned';

export type TicketListPerson = {
  id: string;
  displayName: string;
};

export type TicketListClient = {
  id: string;
  name: string;
};

/** Read-only Client catalog row for Ticket create (ADR 0010). Not List Scope filters. */
export type ClientCatalogRow = {
  id: string;
  name: string;
};

/** Includes soft-deleted. */
export type AdminClientRow = ClientCatalogRow & {
  /** ISO timestamp when soft-deleted; null when listed. */
  deletedAt: string | null;
};

/** Name must be non-empty after trim; uniqueness is global. */
export type CreateClientBody = {
  name: string;
};

/** Rename. Name must be non-empty after trim; uniqueness is global. */
export type UpdateClientBody = {
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

/**
 * Ticket List query filters (synced with `/tickets` URL search params).
 * The API also accepts repeated `status` values. `scope` does not widen List Scope.
 */
export type TicketListFilters = {
  status?: string;
  priority?: string;
  clientId?: string;
  assigneeId?: string;
  stale?: string;
  scope?: string;
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

export type TicketAssignmentHistoryRow = {
  from: TicketListPerson | null;
  to: TicketListPerson | null;
  changedAt: string;
  changedBy: TicketListPerson;
};

export const COMMENT_VISIBILITIES = ['public', 'internal'] as const;

export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

export type TicketComment = {
  id: string;
  body: string;
  visibility: CommentVisibility;
  createdAt: string;
  author: TicketListPerson;
};

export type TicketDetail = TicketListRow & {
  description: string;
  resolvedAt: string | null;
  closedAt: string | null;
  statusHistory: TicketStatusHistoryRow[];
  assignments: TicketAssignmentHistoryRow[];
  comments: TicketComment[];
};

/** Actor names only `to`. `from` is always the current Status. */
export type PatchTicketStatusBody = {
  status: TicketStatus;
};

/** Dedicated Reassignment body. `null` clears Assignee (unassign). */
export type PatchTicketAssigneeBody = {
  assigneeId: string | null;
};

/** Dedicated Field Edit. Omit a field to leave it unchanged. At least one required. */
export type PatchTicketFieldsBody = {
  title?: string;
  description?: string;
  priority?: Priority;
};

/** Read-only staff catalog row for Assignee picker. */
export type UserCatalogRow = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

/** Includes soft-deleted. */
export type AdminUserRow = UserCatalogRow & {
  /** ISO timestamp when soft-deleted; null when listed. */
  deletedAt: string | null;
};

/** Email, displayName, and password must be non-empty after trim. */
export type CreateUserBody = {
  email: string;
  displayName: string;
  role: Role;
  password: string;
};

/** Email is immutable — clients must not send it. */
export type UpdateUserBody = {
  displayName?: string;
  role?: Role;
};

/** Password must be non-empty after trim. */
export type ResetPasswordBody = {
  password: string;
};

/** Visibility omitted defaults to `public`. */
export type CreateTicketCommentBody = {
  body: string;
  visibility?: CommentVisibility;
};

/** Priority omitted defaults to `medium`. Title and description must be non-empty after trim. */
export type CreateTicketBody = {
  clientId: string;
  title: string;
  description: string;
  priority?: Priority;
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
  if (hasMinimumRole(args.role, 'admin')) {
    return true;
  }
  if (args.to === 'closed' || args.from === 'closed') {
    return false;
  }
  return args.assigneeId === args.actorId;
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

export function mayRecordReassignment(role: Role): boolean {
  return hasMinimumRole(role, 'supervisor');
}

export function mayRecordFieldEdit(role: Role): boolean {
  return hasMinimumRole(role, 'supervisor');
}

export const EMPTY_TICKET_LIST_FILTER_OPTIONS: TicketListFilterOptions = {
  clients: [],
  assignees: [],
  includeUnassigned: false,
};
