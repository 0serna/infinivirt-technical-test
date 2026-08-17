import {
  OPEN_TICKET_STATUSES,
  TICKET_LIST_ASSIGNED_OPEN_SCOPE,
  type TicketListRow,
} from './ticket';

/** Cap for Operational Dashboard short tables (oldest `updated_at` first). */
export const DASHBOARD_SHORT_LIST_CAP = 10;

/**
 * Ticket List deep-link for Agent Open-assigned load
 * (`scope=assignedOpen`).
 */
export const DASHBOARD_ASSIGNED_OPEN_LIST_PATH = `/tickets?scope=${TICKET_LIST_ASSIGNED_OPEN_SCOPE}`;

/** Statuses counted as Open Ticket load on the dashboard. */
export const DASHBOARD_OPEN_STATUSES = OPEN_TICKET_STATUSES;

/**
 * Agent Operational Dashboard: personal Open Ticket load where the User is
 * Assignee (not merely `created_by`). No team totals; no Stale section.
 */
export type AgentDashboard = {
  kind: 'agent';
  assignedOpenCount: number;
  /** Cap {@link DASHBOARD_SHORT_LIST_CAP}, oldest `updatedAt` first. */
  assignedOpen: TicketListRow[];
};

/**
 * Team Operational Dashboard (Supervisor / Administrator).
 *
 * Full Open / Stale aggregations are owned by F7.4 (#50). Until then the API
 * may return this shape with zeros and empty lists so `/dashboard` does not
 * crash for Roles above Agent.
 */
export type TeamDashboard = {
  kind: 'team';
  openCount: number;
  openByStatus: {
    open: number;
    in_progress: number;
  };
  staleCount: number;
  /** Cap {@link DASHBOARD_SHORT_LIST_CAP}, oldest `updatedAt` first. */
  stale: TicketListRow[];
};

export type DashboardEnvelope = AgentDashboard | TeamDashboard;

/** Empty team envelope for interim Supervisor/Admin responses (F7.3). */
export const EMPTY_TEAM_DASHBOARD: TeamDashboard = {
  kind: 'team',
  openCount: 0,
  openByStatus: { open: 0, in_progress: 0 },
  staleCount: 0,
  stale: [],
};
