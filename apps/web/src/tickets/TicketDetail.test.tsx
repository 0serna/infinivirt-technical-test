import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  alex,
  isTicketDetailUrl,
  jsonResponse,
  renderApp,
  sam,
  sampleClosedTicketDetail,
  sampleReopenedTicketDetail,
  sampleResolvedTicketDetail,
  sampleTicketDetail,
  sampleTickets,
  unauthorized,
} from '../test/render-app';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function mockTicketSession(
  detail: unknown = sampleTicketDetail,
  user: typeof ada | typeof alex | typeof sam = ada,
) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, user);
    }
    if (url === '/api/tickets' || url.startsWith('/api/tickets?')) {
      return jsonResponse(200, sampleTickets);
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(200, detail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

test('signed-in Ticket consult is inside the staff shell and loads GET /api/tickets/:id', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession();

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(
    screen.getByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();

  const detailCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => url === '/api/tickets/ticket-1');
  expect(detailCall).toBeDefined();
  expect(new Headers(detailCall?.[1]?.headers).get('Authorization')).toBe(
    'Bearer token-abc',
  );
});

test('Ticket consult shows current fields and Status Transition history oldest first', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession(sampleReopenedTicketDetail);

  renderApp(['/tickets/ticket-3']);

  expect(
    await screen.findByRole('heading', {
      name: 'Reopened: returns portal blank page',
    }),
  ).toBeDefined();
  expect(screen.queryByText('MFA reset emails not arriving.')).toBeNull();
  expect(
    screen.getByText(
      'Was closed after hotfix; Client reports regression. Projection timestamps cleared on reopen.',
    ),
  ).toBeDefined();
  expect(screen.getByText('Status: Open')).toBeDefined();
  expect(screen.getByText('Priority: High')).toBeDefined();
  expect(screen.getByText('Client: Northwind Retail')).toBeDefined();
  expect(screen.getByText('Assignee: Alex Agent')).toBeDefined();
  expect(screen.getByText('Created: 22 Jul 2026, 12:00')).toBeDefined();
  expect(screen.queryByText('Waiting on Client network details.')).toBeNull();
  expect(screen.queryByRole('button', { name: /assign/i })).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Mark as in progress' }),
  ).toBeDefined();

  const history = screen.getByRole('table', { name: 'Status history' });
  const rows = within(history).getAllByRole('row');
  expect(within(rows[0]).getByText('From')).toBeDefined();
  expect(within(rows[0]).getByText('To')).toBeDefined();
  expect(within(rows[1]).getByText('—')).toBeDefined();
  expect(within(rows[1]).getByText('Open')).toBeDefined();
  expect(within(rows[2]).getByText('In progress')).toBeDefined();
  expect(within(rows[5]).getByText('Closed')).toBeDefined();
  expect(within(rows[5]).getAllByText('Open').length).toBeGreaterThan(0);
  expect(within(history).getAllByText('Ada Lovelace (user-1)').length).toBe(2);
  expect(within(rows[1]).getByText('Alex Agent (user-2)')).toBeDefined();
});

test('in-flight Ticket consult shows loading before fields', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  let resolveDetail!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    resolveDetail = resolve;
  });
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url)) {
      return pending;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-1']);

  expect(await screen.findByText('Loading ticket…')).toBeDefined();
  expect(screen.queryByText('High: patient portal MFA reset')).toBeNull();

  await act(async () => {
    resolveDetail(jsonResponse(200, sampleTicketDetail));
  });

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(screen.queryByText('Loading ticket…')).toBeNull();
});

test('missing Ticket consult shows not-found copy without the raw server body', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(404, {
        message: 'Cannot GET warehouse scanner pairing',
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-missing']);

  expect(await screen.findByText('Ticket not found.')).toBeDefined();
  expect(screen.queryByText(/warehouse scanner/)).toBeNull();
});

test('failed Ticket consult fetch shows error copy and can retry', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  let detailCalls = 0;
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url)) {
      detailCalls += 1;
      if (detailCalls === 1) {
        return jsonResponse(500, { message: 'Internal boom stack' });
      }
      return jsonResponse(200, sampleTicketDetail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-1']);

  expect(await screen.findByText("Couldn't load this ticket.")).toBeDefined();
  expect(screen.queryByText('Internal boom stack')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Try again' }));

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(screen.queryByText("Couldn't load this ticket.")).toBeNull();
  expect(detailCalls).toBe(2);
});

test('Ticket consult 401 signs the User out', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url)) {
      return unauthorized;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-1']);

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(
    await screen.findByText('Your session expired. Sign in again.'),
  ).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});

test('staff shell title returns to the Ticket List', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession();

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  await user.click(screen.getByRole('link', { name: 'Support Ticketing' }));
  expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeDefined();
  expect(screen.getByText('High: patient portal MFA reset')).toBeDefined();
});

test('Agent who is not Assignee sees no Status Transition control', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession(sampleTicketDetail, alex);

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(
    screen.queryByRole('button', { name: 'Mark as in progress' }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: 'Mark as resolved' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
});

test('Agent Assignee can record the next forward Status Transition', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const updated = {
    ...sampleReopenedTicketDetail,
    status: 'in_progress' as const,
    updatedAt: '2026-08-16T13:00:00.000Z',
    statusHistory: [
      ...sampleReopenedTicketDetail.statusHistory,
      {
        from: 'open' as const,
        to: 'in_progress' as const,
        changedAt: '2026-08-16T13:00:00.000Z',
        changedBy: { id: 'user-2', displayName: 'Alex Agent' },
      },
    ],
  };
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, alex);
    }
    if (url === '/api/tickets' || url.startsWith('/api/tickets?')) {
      return jsonResponse(200, sampleTickets);
    }
    if (isTicketDetailUrl(url) && method === 'PATCH') {
      expect(init?.body).toBe(JSON.stringify({ status: 'in_progress' }));
      return jsonResponse(200, updated);
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(200, sampleReopenedTicketDetail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-3']);

  expect(
    await screen.findByRole('heading', {
      name: 'Reopened: returns portal blank page',
    }),
  ).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Mark as in progress' }));

  expect(await screen.findByText('Status: In progress')).toBeDefined();
  expect(
    screen.queryByRole('button', { name: 'Mark as in progress' }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Mark as resolved' }),
  ).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
});

test('Administrator can record a forward Status Transition on an unassigned Ticket', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const updated = {
    ...sampleTicketDetail,
    status: 'in_progress' as const,
    updatedAt: '2026-08-16T13:00:00.000Z',
    statusHistory: [
      ...sampleTicketDetail.statusHistory,
      {
        from: 'open' as const,
        to: 'in_progress' as const,
        changedAt: '2026-08-16T13:00:00.000Z',
        changedBy: { id: 'user-1', displayName: 'Ada Lovelace' },
      },
    ],
  };
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url) && method === 'PATCH') {
      expect(init?.body).toBe(JSON.stringify({ status: 'in_progress' }));
      return jsonResponse(200, updated);
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(200, sampleTicketDetail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(screen.getByText('Assignee: Unassigned')).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Mark as in progress' }));
  expect(await screen.findByText('Status: In progress')).toBeDefined();
});

test('resolved Ticket offers no Close or Reopen control', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession(
    {
      ...sampleTicketDetail,
      id: 'ticket-2',
      title: 'Resolved: SSO redirect loop',
      status: 'resolved' as const,
      assignee: { id: 'user-3', displayName: 'Sam Supervisor' },
      resolvedAt: '2026-07-30T09:15:00.000Z',
    },
    alex,
  );

  renderApp(['/tickets/ticket-2']);

  expect(
    await screen.findByRole('heading', { name: 'Resolved: SSO redirect loop' }),
  ).toBeDefined();
  expect(screen.getByText('Status: Resolved')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Mark as resolved' })).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Mark as in progress' }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
});

test('failed Status Transition shows error copy without the raw server body', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url) && method === 'PATCH') {
      return jsonResponse(409, { message: 'Illegal edge stack' });
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(200, sampleTicketDetail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Mark as in progress' }));

  expect(
    await screen.findByText("Couldn't update this ticket's status."),
  ).toBeDefined();
  expect(screen.queryByText('Illegal edge stack')).toBeNull();
  expect(screen.getByText('Status: Open')).toBeDefined();
});

test('Agent Assignee on a resolved Ticket sees no Close or Reopen control', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession(sampleResolvedTicketDetail, alex);

  renderApp(['/tickets/ticket-gift-card']);

  expect(
    await screen.findByRole('heading', {
      name: 'Resolved: gift-card balance mismatch',
    }),
  ).toBeDefined();
  expect(screen.getByText('Status: Resolved')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Mark as resolved' })).toBeNull();
});

test('Supervisor on a closed Ticket sees no Close or Reopen control', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession(sampleClosedTicketDetail, sam);

  renderApp(['/tickets/ticket-invoice']);

  expect(
    await screen.findByRole('heading', {
      name: 'Closed: invoice PDF encoding',
    }),
  ).toBeDefined();
  expect(screen.getByText('Status: Closed')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
});

test('Administrator can close a resolved Ticket', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const updated = {
    ...sampleResolvedTicketDetail,
    status: 'closed' as const,
    closedAt: '2026-08-16T13:00:00.000Z',
    updatedAt: '2026-08-16T13:00:00.000Z',
    statusHistory: [
      ...sampleResolvedTicketDetail.statusHistory,
      {
        from: 'resolved' as const,
        to: 'closed' as const,
        changedAt: '2026-08-16T13:00:00.000Z',
        changedBy: { id: 'user-1', displayName: 'Ada Lovelace' },
      },
    ],
  };
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url) && method === 'PATCH') {
      expect(init?.body).toBe(JSON.stringify({ status: 'closed' }));
      return jsonResponse(200, updated);
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(200, sampleResolvedTicketDetail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-gift-card']);

  expect(
    await screen.findByRole('heading', {
      name: 'Resolved: gift-card balance mismatch',
    }),
  ).toBeDefined();
  expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Mark as resolved' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(await screen.findByText('Status: Closed')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Reopen' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
});

test('Administrator can reopen a closed Ticket', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const updated = {
    ...sampleClosedTicketDetail,
    status: 'open' as const,
    resolvedAt: null,
    closedAt: null,
    updatedAt: '2026-08-16T13:00:00.000Z',
    statusHistory: [
      ...sampleClosedTicketDetail.statusHistory,
      {
        from: 'closed' as const,
        to: 'open' as const,
        changedAt: '2026-08-16T13:00:00.000Z',
        changedBy: { id: 'user-1', displayName: 'Ada Lovelace' },
      },
    ],
  };
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url) && method === 'PATCH') {
      expect(init?.body).toBe(JSON.stringify({ status: 'open' }));
      return jsonResponse(200, updated);
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(200, sampleClosedTicketDetail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-invoice']);

  expect(
    await screen.findByRole('heading', {
      name: 'Closed: invoice PDF encoding',
    }),
  ).toBeDefined();
  expect(screen.getByRole('button', { name: 'Reopen' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Mark as in progress' }),
  ).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Reopen' }));

  expect(await screen.findByText('Status: Open')).toBeDefined();
  expect(
    screen.getByRole('button', { name: 'Mark as in progress' }),
  ).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
});
