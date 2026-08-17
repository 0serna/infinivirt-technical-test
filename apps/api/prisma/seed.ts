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
      title: 'Billing portal hangs on invoice list',
      description:
        'Dispatch says the invoices page spins ~40s then times out. They are on the office VPN; nobody has tried off-network. Started Thursday after the billing cutover.',
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
          body: 'Asked them to retry from a phone hotspot and send a HAR. Nothing back since Friday.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(9),
        },
      ],
    },
    {
      key: 'agent-in-progress-acme',
      clientName: 'Acme Logistics',
      title: 'Tracking lookups return 502',
      description:
        'GET /tracking/{id} 502s maybe 1 in 5 on prod. They first saw it yesterday around 14:00. Staging has been clean when I hit it.',
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
          body: 'Reproduced twice on prod with shipment 88421. Gateway log shows an upstream timeout to the carrier adapter.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(1),
        },
        {
          authorEmail: 'supervisor@example.com',
          body: 'If the 14:30 deploy does not kill this, hand it to platform. Do not spend another afternoon on retries.',
          visibility: CommentVisibility.internal,
          createdAt: hoursAgo(6),
        },
      ],
    },
    {
      key: 'critical-northwind',
      clientName: 'Northwind Retail',
      title: 'Card checkout returns 500',
      description:
        'Store 14: card payments get a generic 500 on place-order. Cash and gift cards still go through. Started ~18:40. Ugly for a Saturday.',
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
          body: 'Called Maya at Northwind. They paused the card lane on two registers. Ping me if this is still red at 21:00.',
          visibility: CommentVisibility.internal,
          createdAt: hoursAgo(18),
        },
        {
          authorEmail: 'agent@example.com',
          body: 'place-order 500s are all STRIPE_CONFIRM timeout. Checking the payments worker, not the storefront.',
          visibility: CommentVisibility.public,
          createdAt: hoursAgo(3),
        },
      ],
    },
    {
      key: 'high-contoso-a',
      clientName: 'Contoso Health',
      title: 'Clinic calendar ~15 min behind',
      description:
        'Riverside clinic: new appointments hit the EHR immediately, the patient calendar lags 10-20 minutes. Front desk is double-booking rooms.',
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
      title: 'MFA reset emails not arriving',
      description:
        'Patient 44219 requested an MFA reset at 09:10. Nothing in inbox or spam. Lab-result mail is landing. They use Outlook.',
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
          body: 'Logged from the portal call this morning. Still sitting unassigned.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(1),
        },
      ],
    },
    {
      key: 'critical-fabrikam',
      clientName: 'Fabrikam Motors',
      title: 'Vehicle telemetry stopped overnight',
      description:
        'Fleet ops: no pings since 01:14 from the Midwest trucks (~40 units). Ignition still writes locally on the device. They can drive; the map is blind.',
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
      comments: [
        {
          authorEmail: 'supervisor@example.com',
          body: 'Do not tell them to reboot the whole fleet. Check ingest first.',
          visibility: CommentVisibility.internal,
          createdAt: hoursAgo(27),
        },
        {
          authorEmail: 'agent@example.com',
          body: 'Ingest topic telematics.raw is caught up. Devices in IL/IN last checked in at 01:14 and went quiet together.',
          visibility: CommentVisibility.public,
          createdAt: hoursAgo(4),
        },
      ],
    },
    {
      key: 'high-globex',
      clientName: 'Globex Energy',
      title: 'Meter CSV upload drops rows',
      description:
        'Nightly ~12k-row meter file. UI says success. About 800 rows never show in the reading table. No error email. Same file twice, same holes.',
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
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Missing rows all have a blank multiplier column. Parser treats that as skip, not zero.',
          visibility: CommentVisibility.public,
          createdAt: hoursAgo(10),
        },
      ],
    },
    {
      key: 'high-acme',
      clientName: 'Acme Logistics',
      title: 'New scanners fail Bluetooth pairing',
      description:
        'Six Zebra DS3600s from last week. Pairing dies at "waiting for PIN". Old scanners on the same handhelds still work. They want these on the floor Monday.',
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
      comments: [
        {
          authorEmail: 'supervisor@example.com',
          body: 'Parked here until we have a spare agent. Firmware notes are in the warehouse Slack thread.',
          visibility: CommentVisibility.internal,
          createdAt: hoursAgo(20),
        },
      ],
    },
    {
      key: 'low-initech',
      clientName: 'Initech Soft',
      title: 'Docs still list /v1/shipments',
      description:
        'Public API docs, "Create shipment". Example still posts to /v1/shipments. Prod has been /v2/shipments since March. New integrators keep opening 404 tickets.',
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
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Docs PR is a one-liner. Putting it behind the tracking 502.',
          visibility: CommentVisibility.internal,
          createdAt: daysAgo(5),
        },
      ],
    },
    {
      key: 'resolved-medium-agent',
      clientName: 'Northwind Retail',
      title: 'Gift card balance off after refund',
      description:
        'Order NW-10482: $40 refund posted, gift card still showed $0. They sent a screenshot on the original email.',
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
          body: 'Refund wrote to payments but skipped the gift-card ledger. Ran the repair for GC-8891. Balance is $40. Asked them to refresh the app.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(5),
        },
      ],
    },
    {
      key: 'resolved-high-agent',
      clientName: 'Contoso Health',
      title: 'Fax gateway retry storm',
      description:
        'Outbound clinic faxes to two hospital numbers retried every 8s and wedged the queue (~14k jobs). Inbound was fine.',
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
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Those two numbers return busy. Backoff was 8s with no cap. Set cap to 15 min and drained the queue overnight.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(3),
        },
      ],
    },
    {
      key: 'resolved-critical-agent',
      clientName: 'Fabrikam Motors',
      title: 'VIN lookup returning stale VINs',
      description:
        'Dealers searching a stock number got a VIN from a car sold last month. Started after the cache TTL change Tuesday.',
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
          authorEmail: 'agent@example.com',
          body: 'Cache key was stock number only. Namespaced it with the sold flag and flushed Redis. Spot-checked 20 lookups.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(4),
        },
        {
          authorEmail: 'supervisor@example.com',
          body: 'Write this up Friday. TTL change had no owner.',
          visibility: CommentVisibility.internal,
          createdAt: daysAgo(4),
        },
      ],
    },
    {
      key: 'resolved-low-supervisor-credit',
      clientName: 'Initech Soft',
      title: 'SSO login loops back to IdP',
      description:
        'Initech staff: after Okta password they bounce back to the IdP login. Incognito same thing. Started when they rotated the ACS URL.',
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
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Okta ACS is still the old /sso/callback. I do not have their admin. Sam is taking it.',
          visibility: CommentVisibility.internal,
          createdAt: daysAgo(12),
        },
        {
          authorEmail: 'supervisor@example.com',
          body: 'ACS URL in Okta now matches prod. Had them try incognito; they got through.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(2),
        },
      ],
    },
    {
      key: 'closed-recent-globex',
      clientName: 'Globex Energy',
      title: 'Invoice PDF garbled on accented names',
      description:
        'Customer Nunez: the PDF shows NuÃ±ez in the bill-to line. Screen view is fine. Accounting will not accept that copy.',
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
          authorEmail: 'agent@example.com',
          body: 'Renderer was Latin-1. Fix is in 1.18.2. They opened the new PDF and signed off.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(2),
        },
        {
          authorEmail: 'admin@example.com',
          body: 'They confirmed the new PDF. Closing.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(1),
        },
      ],
    },
    {
      key: 'created-recent-open-initech',
      clientName: 'Initech Soft',
      title: 'Partner webhooks failing HMAC',
      description:
        'Partner Shiply callbacks 401 on our HMAC. They say they did not rotate the secret. Last good delivery 02:11.',
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
      comments: [
        {
          authorEmail: 'agent@example.com',
          body: 'Their payload now includes a timestamp header we do not sign. Checking if we started requiring it on Tuesday.',
          visibility: CommentVisibility.public,
          createdAt: hoursAgo(2),
        },
      ],
    },
    {
      key: 'heavy-reassignment',
      clientName: 'Acme Logistics',
      title: 'Customs form field mapping',
      description:
        'AES form: "port of lading" is writing into destination country. Broker rejected two filings Friday. Three mapping spreadsheets in the shared drive.',
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
          body: 'Pulled this off me while we figure out who owns AES mapping. Do not leave it in the void.',
          visibility: CommentVisibility.internal,
          createdAt: daysAgo(5),
        },
        {
          authorEmail: 'agent@example.com',
          body: 'Using spreadsheet v3 (the one dated 3 Aug). Port of lading now maps to portCode. Will send a test filing tomorrow.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(4),
        },
      ],
    },
    {
      key: 'reopened-cleared-timestamps',
      clientName: 'Northwind Retail',
      title: 'Returns portal blank after submit',
      description:
        'We shipped a hotfix last month and closed this. Northwind called this morning: submit on /returns still dumps a white page in Chrome 128. Firefox is fine. Same SKUs as before.',
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
          body: 'They say it is back. Do not tell them we closed it for good.',
          visibility: CommentVisibility.internal,
          createdAt: hoursAgo(6),
        },
        {
          authorEmail: 'agent@example.com',
          body: 'On the returns submit path again. Need a HAR from Chrome when it blanks.',
          visibility: CommentVisibility.public,
          createdAt: hoursAgo(5),
        },
      ],
    },
    {
      key: 'closed-old-outside-window',
      clientName: 'Fabrikam Motors',
      title: 'Dealer SSO onboarding',
      description:
        'Fabrikam dealer portal SSO. Went live in June. No open work left on this one.',
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
          toStatus: TicketStatus.in_progress,
          changedByEmail: 'supervisor@example.com',
          changedAt: daysAgo(55),
        },
        {
          fromStatus: TicketStatus.in_progress,
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
      comments: [
        {
          authorEmail: 'supervisor@example.com',
          body: 'First dealer group (12 rooftops) signed in through Okta this morning. Closing once Ada signs off.',
          visibility: CommentVisibility.public,
          createdAt: daysAgo(50),
        },
        {
          authorEmail: 'admin@example.com',
          body: 'Signed off. Close it.',
          visibility: CommentVisibility.internal,
          createdAt: daysAgo(45),
        },
      ],
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
