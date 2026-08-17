import { EMPTY_TICKET_LIST_FILTER_OPTIONS } from '@support-ticketing/shared';
import { render } from '@testing-library/react';
import { type InitialEntry, MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../App';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-path">
      {location.pathname}
      {location.search}
    </div>
  );
}

export function renderApp(
  initialEntries: InitialEntry[],
  options?: { probeLocation?: boolean },
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
      {options?.probeLocation ? <LocationProbe /> : null}
    </MemoryRouter>,
  );
}

export function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

export const unauthorized = jsonResponse(401, {
  statusCode: 401,
  message: 'Unauthorized',
});

export const emptyTickets = {
  tickets: [],
  filterOptions: EMPTY_TICKET_LIST_FILTER_OPTIONS,
};

export const sampleTickets = {
  filterOptions: {
    clients: [
      { id: 'client-1', name: 'Contoso Health' },
      { id: 'client-2', name: 'Initech Soft' },
    ],
    assignees: [{ id: 'user-3', displayName: 'Sam Supervisor' }],
    includeUnassigned: true,
  },
  tickets: [
    {
      id: 'ticket-1',
      title: 'High: patient portal MFA reset',
      status: 'open',
      priority: 'high',
      client: { id: 'client-1', name: 'Contoso Health' },
      assignee: null,
      createdBy: { id: 'user-2', displayName: 'Alex Agent' },
      updatedAt: '2026-08-01T12:00:00.000Z',
      createdAt: '2026-07-31T12:00:00.000Z',
    },
    {
      id: 'ticket-2',
      title: 'Resolved: SSO redirect loop',
      status: 'resolved',
      priority: 'low',
      client: { id: 'client-2', name: 'Initech Soft' },
      assignee: { id: 'user-3', displayName: 'Sam Supervisor' },
      createdBy: { id: 'user-2', displayName: 'Alex Agent' },
      updatedAt: '2026-07-30T09:15:00.000Z',
      createdAt: '2026-07-01T09:15:00.000Z',
    },
  ],
};

export const ada = {
  id: 'user-1',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  role: 'admin' as const,
};

export const alex = {
  id: 'user-2',
  email: 'agent@example.com',
  displayName: 'Alex Agent',
  role: 'agent' as const,
};

export const sam = {
  id: 'user-3',
  email: 'supervisor@example.com',
  displayName: 'Sam Supervisor',
  role: 'supervisor' as const,
};

export function isTicketsUrl(url: string): boolean {
  return url === '/api/tickets' || url.startsWith('/api/tickets?');
}

export function isTicketDetailUrl(url: string): boolean {
  return /^\/api\/tickets\/[^/?]+$/.test(url);
}

export function isClientsUrl(url: string): boolean {
  return url === '/api/clients';
}

export function isUsersUrl(url: string): boolean {
  return url === '/api/users';
}

export function isDashboardUrl(url: string): boolean {
  return url === '/api/dashboard';
}

export const sampleAgentDashboard = {
  kind: 'agent' as const,
  openCount: 2,
  openTickets: [
    {
      id: 'ticket-ship',
      title: 'In progress: shipment tracking API',
      status: 'in_progress' as const,
      priority: 'high' as const,
      client: { id: 'client-1', name: 'Acme Logistics' },
      assignee: { id: 'user-2', displayName: 'Alex Agent' },
      createdBy: { id: 'user-2', displayName: 'Alex Agent' },
      updatedAt: '2026-08-15T12:00:00.000Z',
      createdAt: '2026-08-14T12:00:00.000Z',
    },
    {
      id: 'ticket-webhook',
      title: 'Open: webhook signature mismatch',
      status: 'open' as const,
      priority: 'medium' as const,
      client: { id: 'client-2', name: 'Northwind Retail' },
      assignee: { id: 'user-2', displayName: 'Alex Agent' },
      createdBy: { id: 'user-3', displayName: 'Sam Supervisor' },
      updatedAt: '2026-08-16T09:00:00.000Z',
      createdAt: '2026-08-16T08:00:00.000Z',
    },
  ],
};

export const emptyTeamDashboard = {
  kind: 'team' as const,
  openTotal: 0,
  openByStatus: { open: 0, in_progress: 0 },
  staleCount: 0,
  stale: [],
};

export const sampleTeamDashboard = {
  kind: 'team' as const,
  openTotal: 5,
  openByStatus: { open: 3, in_progress: 2 },
  staleCount: 4,
  stale: [
    {
      id: 'ticket-stale-billing',
      title: 'Stale open: billing portal timeout',
      status: 'open' as const,
      priority: 'high' as const,
      client: { id: 'client-acme', name: 'Acme Logistics' },
      assignee: null,
      createdBy: { id: 'user-3', displayName: 'Sam Supervisor' },
      updatedAt: '2026-08-10T12:00:00.000Z',
      createdAt: '2026-08-08T12:00:00.000Z',
    },
    {
      id: 'ticket-gift-card',
      title: 'Resolved: gift-card balance mismatch',
      status: 'resolved' as const,
      priority: 'medium' as const,
      client: { id: 'client-2', name: 'Northwind Retail' },
      assignee: { id: 'user-2', displayName: 'Alex Agent' },
      createdBy: { id: 'user-2', displayName: 'Alex Agent' },
      updatedAt: '2026-08-12T09:00:00.000Z',
      createdAt: '2026-08-11T09:00:00.000Z',
    },
  ],
};

/** Full Client catalog (ADR 0010). Includes Clients absent from list filterOptions. */
export const sampleClientCatalog = [
  { id: 'client-1', name: 'Contoso Health' },
  { id: 'client-2', name: 'Initech Soft' },
  { id: 'client-acme', name: 'Acme Logistics' },
];

/** Read-only staff catalog for Assignee picker. Wider than list filterOptions.assignees. */
export const sampleUserCatalog = [
  {
    id: 'user-1',
    email: 'ada@example.com',
    displayName: 'Ada Lovelace',
    role: 'admin' as const,
  },
  {
    id: 'user-2',
    email: 'agent@example.com',
    displayName: 'Alex Agent',
    role: 'agent' as const,
  },
  {
    id: 'user-3',
    email: 'supervisor@example.com',
    displayName: 'Sam Supervisor',
    role: 'supervisor' as const,
  },
  {
    id: 'user-4',
    email: 'jamie@example.com',
    displayName: 'Jamie Agent',
    role: 'agent' as const,
  },
];

export const sampleTicketDetail = {
  ...sampleTickets.tickets[0],
  status: 'open' as const,
  priority: 'high' as const,
  description: 'MFA reset emails not arriving.',
  resolvedAt: null,
  closedAt: null,
  statusHistory: [
    {
      from: null,
      to: 'open' as const,
      changedAt: '2026-07-31T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
  ],
  assignments: [],
  comments: [
    {
      id: 'comment-1',
      body: 'Created; needs assignment.',
      visibility: 'public' as const,
      createdAt: '2026-07-31T12:30:00.000Z',
      author: { id: 'user-2', displayName: 'Alex Agent' },
    },
  ],
};

export const sampleReopenedTicketDetail = {
  id: 'ticket-3',
  title: 'Reopened: returns portal blank page',
  description:
    'Was closed after hotfix; Client reports regression. Projection timestamps cleared on reopen.',
  status: 'open' as const,
  priority: 'high' as const,
  client: { id: 'client-2', name: 'Northwind Retail' },
  assignee: { id: 'user-2', displayName: 'Alex Agent' },
  createdBy: { id: 'user-2', displayName: 'Alex Agent' },
  updatedAt: '2026-08-16T12:00:00.000Z',
  createdAt: '2026-07-22T12:00:00.000Z',
  resolvedAt: null,
  closedAt: null,
  statusHistory: [
    {
      from: null,
      to: 'open' as const,
      changedAt: '2026-07-22T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
    {
      from: 'open' as const,
      to: 'in_progress' as const,
      changedAt: '2026-07-23T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
    {
      from: 'in_progress' as const,
      to: 'resolved' as const,
      changedAt: '2026-07-25T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
    {
      from: 'resolved' as const,
      to: 'closed' as const,
      changedAt: '2026-07-26T12:00:00.000Z',
      changedBy: { id: 'user-1', displayName: 'Ada Lovelace' },
    },
    {
      from: 'closed' as const,
      to: 'open' as const,
      changedAt: '2026-08-16T06:00:00.000Z',
      changedBy: { id: 'user-1', displayName: 'Ada Lovelace' },
    },
  ],
  assignments: [
    {
      from: null,
      to: { id: 'user-2', displayName: 'Alex Agent' },
      changedAt: '2026-07-22T13:00:00.000Z',
      changedBy: { id: 'user-3', displayName: 'Sam Supervisor' },
    },
  ],
  comments: [
    {
      id: 'comment-reopen-1',
      body: 'Reopened after regression report; prior closed cycle kept in history.',
      visibility: 'internal' as const,
      createdAt: '2026-08-16T06:00:00.000Z',
      author: { id: 'user-1', displayName: 'Ada Lovelace' },
    },
    {
      id: 'comment-reopen-2',
      body: 'Investigating blank page on returns portal again.',
      visibility: 'public' as const,
      createdAt: '2026-08-16T07:00:00.000Z',
      author: { id: 'user-2', displayName: 'Alex Agent' },
    },
  ],
};

export const sampleResolvedTicketDetail = {
  ...sampleTicketDetail,
  id: 'ticket-gift-card',
  title: 'Resolved: gift-card balance mismatch',
  description: 'Balances reconciled after ledger fix.',
  status: 'resolved' as const,
  priority: 'medium' as const,
  client: { id: 'client-2', name: 'Northwind Retail' },
  assignee: { id: 'user-2', displayName: 'Alex Agent' },
  resolvedAt: '2026-08-11T12:00:00.000Z',
  closedAt: null,
  statusHistory: [
    {
      from: null,
      to: 'open' as const,
      changedAt: '2026-08-04T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
    {
      from: 'open' as const,
      to: 'in_progress' as const,
      changedAt: '2026-08-05T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
    {
      from: 'in_progress' as const,
      to: 'resolved' as const,
      changedAt: '2026-08-11T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
  ],
  assignments: [
    {
      from: null,
      to: { id: 'user-2', displayName: 'Alex Agent' },
      changedAt: '2026-08-04T13:00:00.000Z',
      changedBy: { id: 'user-3', displayName: 'Sam Supervisor' },
    },
  ],
  comments: [
    {
      id: 'comment-gift',
      body: 'Ledger patch deployed; balances match.',
      visibility: 'public' as const,
      createdAt: '2026-08-11T12:00:00.000Z',
      author: { id: 'user-2', displayName: 'Alex Agent' },
    },
  ],
};

export const sampleClosedTicketDetail = {
  ...sampleTicketDetail,
  id: 'ticket-invoice',
  title: 'Closed: invoice PDF encoding',
  description: 'UTF-8 fix shipped; Client confirmed.',
  status: 'closed' as const,
  priority: 'medium' as const,
  client: { id: 'client-5', name: 'Globex Energy' },
  assignee: { id: 'user-2', displayName: 'Alex Agent' },
  resolvedAt: '2026-08-14T12:00:00.000Z',
  closedAt: '2026-08-15T12:00:00.000Z',
  statusHistory: [
    {
      from: null,
      to: 'open' as const,
      changedAt: '2026-07-27T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
    {
      from: 'open' as const,
      to: 'in_progress' as const,
      changedAt: '2026-07-29T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
    {
      from: 'in_progress' as const,
      to: 'resolved' as const,
      changedAt: '2026-08-14T12:00:00.000Z',
      changedBy: { id: 'user-2', displayName: 'Alex Agent' },
    },
    {
      from: 'resolved' as const,
      to: 'closed' as const,
      changedAt: '2026-08-15T12:00:00.000Z',
      changedBy: { id: 'user-1', displayName: 'Ada Lovelace' },
    },
  ],
  comments: [],
};

export function mockAuthedSession(
  tickets: unknown = emptyTickets,
  user: typeof ada | typeof alex | typeof sam = ada,
  detail?: unknown,
  dashboard: unknown = user.role === 'agent'
    ? sampleAgentDashboard
    : emptyTeamDashboard,
) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, user);
    }
    if (isDashboardUrl(url)) {
      return jsonResponse(200, dashboard);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, tickets);
    }
    if (isUsersUrl(url)) {
      return jsonResponse(200, sampleUserCatalog);
    }
    if (detail !== undefined && isTicketDetailUrl(url)) {
      return jsonResponse(200, detail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}
