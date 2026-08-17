import {
  OPEN_TICKET_LOAD_STATUS_QUERY,
  TICKET_LIST_ASSIGNED_OPEN_SCOPE,
  TICKET_LIST_STALE_QUERY,
  type TicketListRow,
} from './ticket';

/** Cap for Operational Dashboard short tables (oldest `updated_at` first). */
export const DASHBOARD_SHORT_LIST_CAP = 10;

/**
 * Ticket List deep-link for Agent Open Tickets as Assignee
 * (`scope=assignedOpen`).
 */
export const DASHBOARD_ASSIGNED_OPEN_LIST_PATH = `/tickets?scope=${TICKET_LIST_ASSIGNED_OPEN_SCOPE}`;

/** Ticket List deep-link for team Open Ticket load (`open` + `in_progress`). */
export const DASHBOARD_OPEN_LOAD_LIST_PATH = `/tickets?status=${OPEN_TICKET_LOAD_STATUS_QUERY}`;

/** Ticket List deep-link for Status `open` only. */
export const DASHBOARD_OPEN_STATUS_LIST_PATH = '/tickets?status=open';

/** Ticket List deep-link for Status `in_progress` only. */
export const DASHBOARD_IN_PROGRESS_STATUS_LIST_PATH =
  '/tickets?status=in_progress';

/** Ticket List deep-link for Stale Tickets (`stale=1`). */
export const DASHBOARD_STALE_LIST_PATH = `/tickets?stale=${TICKET_LIST_STALE_QUERY}`;

/**
 * Agent Operational Dashboard: personal Open Ticket load where the User is
 * Assignee (not merely `created_by`). No team totals; no Stale section.
 */
export type AgentDashboard = {
  kind: 'agent';
  openCount: number;
  /** Cap {@link DASHBOARD_SHORT_LIST_CAP}, oldest `updatedAt` first. */
  openTickets: TicketListRow[];
};

/**
 * Team Operational Dashboard (Supervisor / Administrator): account-wide Open
 * Ticket load, Open-by-Status, and Stale count + short list. No Admin-only
 * metrics in F7.
 */
export type TeamDashboard = {
  kind: 'team';
  openTotal: number;
  openByStatus: {
    open: number;
    in_progress: number;
  };
  staleCount: number;
  /** Cap {@link DASHBOARD_SHORT_LIST_CAP}, oldest `updatedAt` first. */
  stale: TicketListRow[];
};

export type DashboardEnvelope = AgentDashboard | TeamDashboard;
