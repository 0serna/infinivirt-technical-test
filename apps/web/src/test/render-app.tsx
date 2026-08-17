import { EMPTY_TICKET_LIST_FILTER_OPTIONS } from '@support-ticketing/shared';
import { render } from '@testing-library/react';
import { type InitialEntry, MemoryRouter } from 'react-router-dom';
import { App } from '../App';

export function renderApp(initialEntries: InitialEntry[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
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

export const sampleFilterOptions = {
  clients: [
    { id: 'client-1', name: 'Contoso Health' },
    { id: 'client-2', name: 'Initech Soft' },
  ],
  assignees: [{ id: 'user-3', displayName: 'Sam Supervisor' }],
  includeUnassigned: true,
};

export const sampleTickets = {
  filterOptions: sampleFilterOptions,
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

export function mockAuthedSession(
  tickets: unknown = emptyTickets,
  user: typeof ada | typeof alex | typeof sam = ada,
) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, user);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, tickets);
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}
