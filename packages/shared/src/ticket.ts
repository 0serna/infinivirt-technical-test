import { hasMinimumRole, type Role } from './role';

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Statuses that count as Open Ticket load (not resolved/closed). */
export const OPEN_TICKET_STATUSES = ['open', 'in_progress'] as const;

export type OpenTicketStatus = (typeof OPEN_TICKET_STATUSES)[number];

/**
 * Ticket List `status` query for Open Ticket load (multi-Status).
 * Prefer this over inventing a separate list endpoint for dashboard deep-links.
 */
export const OPEN_TICKET_LOAD_STATUS_QUERY = 'open,in_progress';

/** Ticket List `stale` query: `updated_at` older than 48h and Status ≠ closed. */
export const TICKET_LIST_STALE_QUERY = '1';

/** Ticket List `scope` query: Open Tickets where Assignee is the current User. */
export const TICKET_LIST_ASSIGNED_OPEN_SCOPE = 'assignedOpen';

/** Stale Ticket age threshold (ADR 0011). */
export const STALE_TICKET_MAX_AGE_HOURS = 48;

/** Instant before which `updated_at` counts as Stale. */
export function staleTicketCutoff(nowMs = Date.now()): Date {
  return new Date(nowMs - STALE_TICKET_MAX_AGE_HOURS * 60 * 60 * 1000);
}

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

/** Read-only Client catalog row for Ticket create (ADR 0010). Not List Scope filters. */
export type ClientCatalogRow = {
  id: string;
  name: string;
  /** ISO timestamp when soft-deleted; null when active. */
  deletedAt: string | null;
};

/** Administrator Client create. Name must be non-empty after trim; uniqueness is global. */
export type CreateClientBody = {
  name: string;
};

/** Administrator Client rename. Name must be non-empty after trim; uniqueness is global. */
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
 *
 * - `status`: one Status, or comma-separated multi-Status for Open Ticket load
 *   (`open,in_progress`). The API also accepts repeated `status` values.
 * - `stale`: `1` for Stale Tickets (`updated_at` older than 48h, Status ≠ closed).
 * - `scope`: `assignedOpen` for Open Tickets assigned to the current User
 *   (does not widen List Scope).
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

/** Read-only staff catalog row for Assignee picker / Admin Users. */
export type UserCatalogRow = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  /** ISO timestamp when soft-deleted; null when active. */
  deletedAt: string | null;
};

/** Administrator User create. Email/displayName/password non-empty after trim; role is enum. */
export type CreateUserBody = {
  email: string;
  displayName: string;
  role: Role;
  password: string;
};

/**
 * Administrator User update. Partial: displayName and/or role.
 * Email is immutable — clients must not send it.
 */
export type UpdateUserBody = {
  displayName?: string;
  role?: Role;
};

/** Administrator password reset. Password non-empty after trim. */
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

export const EMPTY_TICKET_LIST_FILTER_OPTIONS: TicketListFilterOptions = {
  clients: [],
  assignees: [],
  includeUnassigned: false,
};
