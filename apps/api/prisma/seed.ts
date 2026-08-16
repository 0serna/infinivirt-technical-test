import { createHash, randomUUID } from 'node:crypto';
import {
  CommentVisibility,
  Priority,
  type Prisma,
  PrismaClient,
  Role,
  TicketStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * bcrypt hash of the demo password documented in README (cost 10).
 * Plaintext password is not stored in this file.
 */
const DEMO_PASSWORD_HASH =
  '$2b$10$Ob0EtIeu1fSWcQvAdx6h3OPOsuPJATn8IVArSoGXrUDPlXyNBfXle';

const hoursAgo = (hours: number): Date =>
  new Date(Date.now() - hours * 60 * 60 * 1000);

const daysAgo = (days: number): Date => hoursAgo(days * 24);

/** Deterministic UUID so re-runs upsert the same ticket rows. */
function stableSeedUuid(key: string): string {
  const hex = createHash('sha256')
    .update(`support-ticketing-seed:${key}`)
    .digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

const USERS = [
  {
    email: 'agent@example.com',
    displayName: 'Alex Agent',
    role: Role.agent,
  },
  {
    email: 'supervisor@example.com',
    displayName: 'Sam Supervisor',
    role: Role.supervisor,
  },
  {
    email: 'admin@example.com',
    displayName: 'Ada Admin',
    role: Role.admin,
  },
] as const;

const CLIENT_NAMES = [
  'Acme Logistics',
  'Northwind Retail',
  'Contoso Health',
  'Fabrikam Motors',
  'Globex Energy',
  'Initech Soft',
] as const;

type SeedTicket = {
  key: string;
  clientName: (typeof CLIENT_NAMES)[number];
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  assigneeEmail: string | null;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  statusHistory: Array<{
    fromStatus: TicketStatus | null;
    toStatus: TicketStatus;
    changedByEmail: string;
    changedAt: Date;
  }>;
  assignments: Array<{
    fromAssigneeEmail: string | null;
    toAssigneeEmail: string | null;
    changedByEmail: string;
    changedAt: Date;
  }>;
  comments: Array<{
    authorEmail: string;
    body: string;
    visibility: CommentVisibility;
    createdAt: Date;
  }>;
};

function buildTickets(): SeedTicket[] {
  return [
    {
      key: 'stale-open-acme',
      clientName: 'Acme Logistics',
      title: 'Stale open: billing portal timeout',
      description: 'Client cannot load invoices; last touch was days ago.',
      status: TicketStatus.open,
      priority: Priority.medium,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'supervisor@example.com',
      createdAt: daysAgo(10),
      updatedAt: daysAgo(3),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(10),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(10),
        },
      ],
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Waiting on Client network details.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(9),
        },
      ],
    },
    {
      key: 'agent-in-progress-acme',
      clientName: 'Acme Logistics',
      title: 'In progress: shipment tracking API',
      description: 'Intermittent 502s on tracking lookups.',
      status: TicketStatus.in_progress,
      priority: Priority.high,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'agent@example.com',
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(5),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(2),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(1),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(2),
        },
      ],
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Reproduced against staging; checking gateway logs.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(1),
        },
        {
          authorEmail: 'supervisor@example.com',
          body: 'Escalate to platform if still failing after deploy.',
          visibility: CommentVisibility.internal,
          createdAt: hoursAgo(6),
        },
      ],
    },
    {
      key: 'critical-northwind',
      clientName: 'Northwind Retail',
      title: 'Critical: checkout outage',
      description: 'Checkout returns 500 for card payments.',
      status: TicketStatus.open,
      priority: Priority.critical,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'admin@example.com',
      createdAt: hoursAgo(20),
      updatedAt: hoursAgo(3),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'admin@example.com',
          changedAt: hoursAgo(20),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'admin@example.com',
          changedAt: hoursAgo(19),
        },
      ],
      comments: [
        {
          authorEmail: 'admin@example.com',
          body: 'P1 — keep the Client updated hourly.',
          visibility: CommentVisibility.internal,
          createdAt: hoursAgo(18),
        },
      ],
    },
    {
      key: 'high-contoso-a',
      clientName: 'Contoso Health',
      title: 'High: appointment sync lag',
      description: 'Clinic calendar lags by ~15 minutes.',
      status: TicketStatus.in_progress,
      priority: Priority.high,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'supervisor@example.com',
      createdAt: daysAgo(3),
      updatedAt: hoursAgo(12),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(3),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(2),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(3),
        },
      ],
      comments: [],
    },
    {
      key: 'high-contoso-b',
      clientName: 'Contoso Health',
      title: 'High: patient portal MFA reset',
      description: 'MFA reset emails not arriving.',
      status: TicketStatus.open,
      priority: Priority.high,
      assigneeEmail: null,
      createdByEmail: 'agent@example.com',
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(8),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(1),
        },
      ],
      assignments: [],
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Created; needs assignment.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(1),
        },
      ],
    },
    {
      key: 'critical-fabrikam',
      clientName: 'Fabrikam Motors',
      title: 'Critical: telematics feed down',
      description: 'Vehicle telemetry stopped overnight.',
      status: TicketStatus.open,
      priority: Priority.critical,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'supervisor@example.com',
      createdAt: hoursAgo(30),
      updatedAt: hoursAgo(4),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'supervisor@example.com',
          changedAt: hoursAgo(30),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: hoursAgo(28),
        },
      ],
      comments: [],
    },
    {
      key: 'high-globex',
      clientName: 'Globex Energy',
      title: 'High: meter reading upload failures',
      description: 'Batch upload rejects CSV rows silently.',
      status: TicketStatus.open,
      priority: Priority.high,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'agent@example.com',
      createdAt: daysAgo(4),
      updatedAt: hoursAgo(10),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(4),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(4),
        },
      ],
      comments: [],
    },
    {
      key: 'high-acme',
      clientName: 'Acme Logistics',
      title: 'High: warehouse scanner pairing',
      description: 'New scanners fail Bluetooth pairing.',
      status: TicketStatus.open,
      priority: Priority.high,
      assigneeEmail: null,
      createdByEmail: 'supervisor@example.com',
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(20),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(1),
        },
      ],
      assignments: [],
      comments: [],
    },
    {
      key: 'low-initech',
      clientName: 'Initech Soft',
      title: 'Low: documentation typo',
      description: 'API docs show outdated endpoint path.',
      status: TicketStatus.open,
      priority: Priority.low,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'agent@example.com',
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(5),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(5),
        },
      ],
      comments: [],
    },
    {
      key: 'resolved-medium-agent',
      clientName: 'Northwind Retail',
      title: 'Resolved: gift-card balance mismatch',
      description: 'Balances reconciled after ledger fix.',
      status: TicketStatus.resolved,
      priority: Priority.medium,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'agent@example.com',
      createdAt: daysAgo(12),
      updatedAt: daysAgo(5),
      resolvedAt: daysAgo(5),
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(12),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(11),
        },
        {
          fromStatus: TicketStatus.in_progress,
          toStatus: TicketStatus.resolved,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(5),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(12),
        },
      ],
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Ledger patch deployed; balances match.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(5),
        },
      ],
    },
    {
      key: 'resolved-high-agent',
      clientName: 'Contoso Health',
      title: 'Resolved: fax gateway retry storm',
      description: 'Backoff tuned; queue drained.',
      status: TicketStatus.resolved,
      priority: Priority.high,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'supervisor@example.com',
      createdAt: daysAgo(8),
      updatedAt: daysAgo(3),
      resolvedAt: daysAgo(3),
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(8),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(7),
        },
        {
          fromStatus: TicketStatus.in_progress,
          toStatus: TicketStatus.resolved,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(3),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(8),
        },
      ],
      comments: [],
    },
    {
      key: 'resolved-critical-agent',
      clientName: 'Fabrikam Motors',
      title: 'Resolved: VIN lookup cache poison',
      description: 'Cache keys namespaced; critical path restored.',
      status: TicketStatus.resolved,
      priority: Priority.critical,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'admin@example.com',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(4),
      resolvedAt: daysAgo(4),
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(6),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(6),
        },
        {
          fromStatus: TicketStatus.in_progress,
          toStatus: TicketStatus.resolved,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(4),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(6),
        },
      ],
      comments: [
        {
          authorEmail: 'supervisor@example.com',
          body: 'Postmortem scheduled for Friday.',
          visibility: CommentVisibility.internal,
          createdAt: daysAgo(4),
        },
      ],
    },
    {
      key: 'resolved-low-supervisor-credit',
      clientName: 'Initech Soft',
      title: 'Resolved: SSO redirect loop',
      description: 'Callback URL corrected in IdP.',
      status: TicketStatus.resolved,
      priority: Priority.low,
      assigneeEmail: 'supervisor@example.com',
      createdByEmail: 'agent@example.com',
      createdAt: daysAgo(15),
      updatedAt: daysAgo(2),
      resolvedAt: daysAgo(2),
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(15),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(10),
        },
        {
          fromStatus: TicketStatus.in_progress,
          toStatus: TicketStatus.resolved,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(2),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(15),
        },
        {
          fromAssigneeEmail: 'agent@example.com',
          toAssigneeEmail: 'supervisor@example.com',
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(10),
        },
      ],
      comments: [],
    },
    {
      key: 'closed-recent-globex',
      clientName: 'Globex Energy',
      title: 'Closed: invoice PDF encoding',
      description: 'UTF-8 fix shipped; Client confirmed.',
      status: TicketStatus.closed,
      priority: Priority.medium,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'agent@example.com',
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
      resolvedAt: daysAgo(2),
      closedAt: daysAgo(1),
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(20),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(18),
        },
        {
          fromStatus: TicketStatus.in_progress,
          toStatus: TicketStatus.resolved,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(2),
        },
        {
          fromStatus: TicketStatus.resolved,
          toStatus: TicketStatus.closed,
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(1),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(20),
        },
      ],
      comments: [
        {
          authorEmail: 'admin@example.com',
          body: 'Closing after Client confirmation.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(1),
        },
      ],
    },
    {
      key: 'created-recent-open-initech',
      clientName: 'Initech Soft',
      title: 'Open: webhook signature mismatch',
      description: 'Partner callbacks failing HMAC check.',
      status: TicketStatus.open,
      priority: Priority.medium,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'supervisor@example.com',
      createdAt: daysAgo(3),
      updatedAt: hoursAgo(2),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(3),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(3),
        },
      ],
      comments: [],
    },
    {
      key: 'heavy-reassignment',
      clientName: 'Acme Logistics',
      title: 'Reassigned often: customs form mapping',
      description: 'Field mapping bounced between agents.',
      status: TicketStatus.in_progress,
      priority: Priority.medium,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'supervisor@example.com',
      createdAt: daysAgo(7),
      updatedAt: hoursAgo(15),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(7),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(6),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(7),
        },
        {
          fromAssigneeEmail: 'agent@example.com',
          toAssigneeEmail: 'supervisor@example.com',
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(6),
        },
        {
          fromAssigneeEmail: 'supervisor@example.com',
          toAssigneeEmail: null,
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(5),
        },
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(4),
        },
      ],
      comments: [
        {
          authorEmail: 'supervisor@example.com',
          body: 'Unassigned briefly while clarifying the Assignee.',
          visibility: CommentVisibility.internal,
          createdAt: daysAgo(5),
        },
        {
          authorEmail: 'agent@example.com',
          body: 'Back on this; mapping draft attached in next update.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(4),
        },
      ],
    },
    {
      key: 'reopened-cleared-timestamps',
      clientName: 'Northwind Retail',
      title: 'Reopened: returns portal blank page',
      description:
        'Was closed after hotfix; Client reports regression. Projection timestamps cleared on reopen.',
      status: TicketStatus.open,
      priority: Priority.high,
      assigneeEmail: 'agent@example.com',
      createdByEmail: 'agent@example.com',
      createdAt: daysAgo(25),
      updatedAt: hoursAgo(6),
      resolvedAt: null,
      closedAt: null,
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(25),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(24),
        },
        {
          fromStatus: TicketStatus.in_progress,
          toStatus: TicketStatus.resolved,
          changedByEmail: 'agent@example.com',
          changedAt: daysAgo(22),
        },
        {
          fromStatus: TicketStatus.resolved,
          toStatus: TicketStatus.closed,
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(21),
        },
        {
          fromStatus: TicketStatus.closed,
          toStatus: TicketStatus.open,
          changedByEmail: 'admin@example.com',
          changedAt: hoursAgo(6),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'agent@example.com',
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(25),
        },
      ],
      comments: [
        {
          authorEmail: 'admin@example.com',
          body: 'Reopened after regression report; prior closed cycle kept in history.',
          visibility: CommentVisibility.internal,
          createdAt: hoursAgo(6),
        },
        {
          authorEmail: 'agent@example.com',
          body: 'Investigating blank page on returns portal again.',
          visibility: CommentVisibility.public,
          createdAt: hoursAgo(5),
        },
      ],
    },
    {
      key: 'closed-old-outside-window',
      clientName: 'Fabrikam Motors',
      title: 'Closed (older): dealer SSO onboarding',
      description: 'Completed last quarter; outside 30-day closed window.',
      status: TicketStatus.closed,
      priority: Priority.low,
      assigneeEmail: 'supervisor@example.com',
      createdByEmail: 'admin@example.com',
      createdAt: daysAgo(60),
      updatedAt: daysAgo(45),
      resolvedAt: daysAgo(50),
      closedAt: daysAgo(45),
      statusHistory: [
        {
          fromStatus: null,
          toStatus: TicketStatus.open,
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(60),
        },
        {
          fromStatus: TicketStatus.open,
          toStatus: TicketStatus.resolved,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(50),
        },
        {
          fromStatus: TicketStatus.resolved,
          toStatus: TicketStatus.closed,
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(45),
        },
      ],
      assignments: [
        {
          fromAssigneeEmail: null,
          toAssigneeEmail: 'supervisor@example.com',
          changedByEmail: 'admin@example.com',
          changedAt: daysAgo(60),
        },
      ],
      comments: [],
    },
  ];
}

async function seedUsers(): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  for (const user of USERS) {
    const fields = {
      displayName: user.displayName,
      passwordHash: DEMO_PASSWORD_HASH,
      role: user.role,
    };
    const row = await prisma.user.upsert({
      where: { email: user.email },
      create: { email: user.email, ...fields },
      update: fields,
    });
    byEmail.set(user.email, row.id);
  }
  return byEmail;
}

async function seedClients(): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  for (const name of CLIENT_NAMES) {
    const row = await prisma.client.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    byName.set(name, row.id);
  }
  return byName;
}

async function replaceTicketGraph(
  ticket: SeedTicket,
  usersByEmail: Map<string, string>,
  clientsByName: Map<string, string>,
): Promise<void> {
  const ticketId = stableSeedUuid(ticket.key);
  const clientId = clientsByName.get(ticket.clientName);
  const createdById = usersByEmail.get(ticket.createdByEmail);
  if (!clientId || !createdById) {
    throw new Error(`Missing client or creator for ticket ${ticket.key}`);
  }

  const assigneeId = ticket.assigneeEmail
    ? usersByEmail.get(ticket.assigneeEmail)
    : null;
  if (ticket.assigneeEmail && !assigneeId) {
    throw new Error(
      `Missing assignee ${ticket.assigneeEmail} for ${ticket.key}`,
    );
  }

  const data: Prisma.TicketUncheckedCreateInput = {
    id: ticketId,
    clientId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    assigneeId,
    createdById,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
  };

  const { id, ...update } = data;
  await prisma.ticket.upsert({
    where: { id },
    create: data,
    update,
  });

  await prisma.comment.deleteMany({ where: { ticketId } });
  await prisma.ticketAssignment.deleteMany({ where: { ticketId } });
  await prisma.ticketStatusHistory.deleteMany({ where: { ticketId } });

  for (const row of ticket.statusHistory) {
    const changedById = usersByEmail.get(row.changedByEmail);
    if (!changedById) {
      throw new Error(`Missing status actor ${row.changedByEmail}`);
    }
    await prisma.ticketStatusHistory.create({
      data: {
        id: randomUUID(),
        ticketId,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        changedById,
        changedAt: row.changedAt,
      },
    });
  }

  for (const row of ticket.assignments) {
    const changedById = usersByEmail.get(row.changedByEmail);
    if (!changedById) {
      throw new Error(`Missing assignment actor ${row.changedByEmail}`);
    }
    const fromAssigneeId = row.fromAssigneeEmail
      ? usersByEmail.get(row.fromAssigneeEmail)
      : null;
    const toAssigneeId = row.toAssigneeEmail
      ? usersByEmail.get(row.toAssigneeEmail)
      : null;
    if (row.fromAssigneeEmail && !fromAssigneeId) {
      throw new Error(`Missing from assignee ${row.fromAssigneeEmail}`);
    }
    if (row.toAssigneeEmail && !toAssigneeId) {
      throw new Error(`Missing to assignee ${row.toAssigneeEmail}`);
    }
    await prisma.ticketAssignment.create({
      data: {
        id: randomUUID(),
        ticketId,
        fromAssigneeId,
        toAssigneeId,
        changedById,
        changedAt: row.changedAt,
      },
    });
  }

  for (const row of ticket.comments) {
    const authorId = usersByEmail.get(row.authorEmail);
    if (!authorId) {
      throw new Error(`Missing comment author ${row.authorEmail}`);
    }
    await prisma.comment.create({
      data: {
        id: randomUUID(),
        ticketId,
        authorId,
        body: row.body,
        visibility: row.visibility,
        createdAt: row.createdAt,
      },
    });
  }

  // Prisma @updatedAt can refresh on nested writes; pin projection timestamps.
  await prisma.$executeRaw`
    UPDATE tickets
    SET
      created_at = ${ticket.createdAt},
      updated_at = ${ticket.updatedAt},
      resolved_at = ${ticket.resolvedAt},
      closed_at = ${ticket.closedAt}
    WHERE id = ${ticketId}::uuid
  `;
}

async function main(): Promise<void> {
  const usersByEmail = await seedUsers();
  const clientsByName = await seedClients();
  const tickets = buildTickets();

  for (const ticket of tickets) {
    await replaceTicketGraph(ticket, usersByEmail, clientsByName);
  }

  console.log(
    `Seed complete: ${USERS.length} users, ${CLIENT_NAMES.length} clients, ${tickets.length} tickets.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
