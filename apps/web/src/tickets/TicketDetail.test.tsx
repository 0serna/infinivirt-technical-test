import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  alex,
  isTicketDetailUrl,
  isTicketsUrl,
  jsonResponse,
  mockAuthedSession,
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

type SessionUser = typeof ada | typeof alex | typeof sam;

async function chooseStatusTransition(
  user: ReturnType<typeof userEvent.setup>,
  label: RegExp | string,
) {
  await user.click(screen.getByRole('button', { name: 'Change status' }));
  await user.click(await screen.findByRole('menuitem', { name: label }));
}

function mockTicketSession(
  detail: unknown = sampleTicketDetail,
  user: SessionUser = ada,
) {
  mockAuthedSession(sampleTickets, user, detail);
}

function mockTicketPatchSession({
  detail,
  user = ada,
  expectedStatus,
  updated,
  patchResponse,
}: {
  detail: unknown;
  user?: SessionUser;
  expectedStatus?: string;
  updated?: unknown;
  patchResponse?: Response;
}) {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, user);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    if (isTicketDetailUrl(url) && method === 'PATCH') {
      if (patchResponse) {
        return patchResponse;
      }
      expect(init?.body).toBe(JSON.stringify({ status: expectedStatus }));
      return jsonResponse(200, updated);
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
  expect(screen.getByLabelText('Status: Open')).toBeDefined();
  expect(screen.getByLabelText('Priority: High')).toBeDefined();
  expect(screen.getByLabelText('Client: Northwind Retail')).toBeDefined();
  expect(screen.getByLabelText('Assignee: Alex Agent')).toBeDefined();
  expect(screen.getByLabelText('Created: 22 Jul 2026, 12:00')).toBeDefined();
  expect(screen.queryByText('Waiting on Client network details.')).toBeNull();
  expect(screen.queryByRole('button', { name: /assign/i })).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Comment' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Change status' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'Tickets' })).toBeDefined();

  const history = screen.getByLabelText('Status history');
  expect(within(history).getByText('Created → Open')).toBeDefined();
  expect(within(history).getByText('Open → In progress')).toBeDefined();
  expect(within(history).getByText('Resolved → Closed')).toBeDefined();
  expect(within(history).getByText('Closed → Open')).toBeDefined();
  expect(within(history).getAllByText(/Ada Lovelace \(user-1\)/).length).toBe(
    2,
  );
  expect(
    within(history).getByText(/Alex Agent \(user-2\) · 22 Jul 2026/),
  ).toBeDefined();
});

test('Ticket consult shows Comment thread oldest first with visibility, author, and timestamp', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession(sampleReopenedTicketDetail, alex);

  renderApp(['/tickets/ticket-3']);

  expect(
    await screen.findByRole('heading', {
      name: 'Reopened: returns portal blank page',
    }),
  ).toBeDefined();

  const thread = screen.getByLabelText('Comments');
  expect(within(thread).getByText('Comments')).toBeDefined();
  expect(
    within(thread).getByText(
      'Reopened after regression report; prior closed cycle kept in history.',
    ),
  ).toBeDefined();
  expect(
    within(thread).getByText(
      'Investigating blank page on returns portal again.',
    ),
  ).toBeDefined();
  expect(within(thread).getByLabelText('Visibility: Internal')).toBeDefined();
  expect(within(thread).getByLabelText('Visibility: Public')).toBeDefined();
  expect(
    within(thread).getByText(/Ada Lovelace \(user-1\) · 16 Aug 2026/),
  ).toBeDefined();
  expect(
    within(thread).getByText(/Alex Agent \(user-2\) · 16 Aug 2026/),
  ).toBeDefined();
  expect(screen.getByRole('textbox', { name: 'Comment' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Add comment' })).toBeDefined();
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
});

test('Ticket consult with no Comments shows an empty thread state', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession(sampleClosedTicketDetail);

  renderApp(['/tickets/ticket-invoice']);

  expect(
    await screen.findByRole('heading', {
      name: 'Closed: invoice PDF encoding',
    }),
  ).toBeDefined();
  const thread = screen.getByLabelText('Comments');
  expect(within(thread).getByText('No comments yet.')).toBeDefined();
  expect(within(thread).queryByLabelText(/Visibility:/)).toBeNull();
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
  expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Comment' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Add comment' })).toBeDefined();
});

test('Agent can submit a public Comment and the thread updates without a visibility control', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const updated = {
    ...sampleTicketDetail,
    updatedAt: '2026-08-16T14:00:00.000Z',
    comments: [
      ...sampleTicketDetail.comments,
      {
        id: 'comment-new',
        body: 'Client confirmed MFA emails still missing.',
        visibility: 'public' as const,
        createdAt: '2026-08-16T14:00:00.000Z',
        author: { id: 'user-2', displayName: 'Alex Agent' },
      },
    ],
  };
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, alex);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    if (url === '/api/tickets/ticket-1/comments' && method === 'POST') {
      expect(init?.body).toBe(
        JSON.stringify({
          body: 'Client confirmed MFA emails still missing.',
          visibility: 'public',
        }),
      );
      return jsonResponse(201, updated);
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
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
  await user.type(
    screen.getByRole('textbox', { name: 'Comment' }),
    'Client confirmed MFA emails still missing.',
  );
  await user.click(screen.getByRole('button', { name: 'Add comment' }));

  const thread = await screen.findByLabelText('Comments');
  expect(
    within(thread).getByText('Client confirmed MFA emails still missing.'),
  ).toBeDefined();
  expect(within(thread).getByText('Created; needs assignment.')).toBeDefined();
  expect(
    (screen.getByRole('textbox', { name: 'Comment' }) as HTMLTextAreaElement)
      .value,
  ).toBe('');
});

test('failed Comment create shows error copy without the raw server body', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, alex);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    if (url === '/api/tickets/ticket-1/comments' && method === 'POST') {
      return jsonResponse(500, { message: 'Internal boom stack' });
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
  await user.type(
    screen.getByRole('textbox', { name: 'Comment' }),
    'Should fail.',
  );
  await user.click(screen.getByRole('button', { name: 'Add comment' }));

  expect(await screen.findByText("Couldn't add this comment.")).toBeDefined();
  expect(screen.queryByText('Internal boom stack')).toBeNull();
  const thread = screen.getByLabelText('Comments');
  expect(within(thread).getByText('Created; needs assignment.')).toBeDefined();
  expect(within(thread).queryByText('Should fail.')).toBeNull();
});

test('Supervisor Comment composer offers visibility defaulting to public and can post internal', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const updated = {
    ...sampleTicketDetail,
    updatedAt: '2026-08-16T14:05:00.000Z',
    comments: [
      ...sampleTicketDetail.comments,
      {
        id: 'comment-internal',
        body: 'Internal: escalate if firmware lag persists.',
        visibility: 'internal' as const,
        createdAt: '2026-08-16T14:05:00.000Z',
        author: { id: 'user-3', displayName: 'Sam Supervisor' },
      },
    ],
  };
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, sam);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    if (url === '/api/tickets/ticket-1/comments' && method === 'POST') {
      expect(init?.body).toBe(
        JSON.stringify({
          body: 'Internal: escalate if firmware lag persists.',
          visibility: 'internal',
        }),
      );
      return jsonResponse(201, updated);
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
  const visibility = screen.getByRole('combobox', {
    name: 'Visibility',
  }) as HTMLInputElement;
  expect(visibility).toBeDefined();
  expect(visibility.value).toBe('Public');
  await user.click(visibility);
  await user.click(
    screen.getByRole('option', { name: 'Internal', hidden: true }),
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Comment' }),
    'Internal: escalate if firmware lag persists.',
  );
  await user.click(screen.getByRole('button', { name: 'Add comment' }));

  const thread = await screen.findByLabelText('Comments');
  expect(
    within(thread).getByText('Internal: escalate if firmware lag persists.'),
  ).toBeDefined();
  expect(within(thread).getByLabelText('Visibility: Internal')).toBeDefined();
});

test('Administrator Comment composer defaults to public without changing visibility', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const updated = {
    ...sampleTicketDetail,
    updatedAt: '2026-08-16T14:10:00.000Z',
    comments: [
      ...sampleTicketDetail.comments,
      {
        id: 'comment-admin-public',
        body: 'Administrator public note for Client.',
        visibility: 'public' as const,
        createdAt: '2026-08-16T14:10:00.000Z',
        author: { id: 'user-1', displayName: 'Ada Lovelace' },
      },
    ],
  };
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    if (url === '/api/tickets/ticket-1/comments' && method === 'POST') {
      expect(init?.body).toBe(
        JSON.stringify({
          body: 'Administrator public note for Client.',
          visibility: 'public',
        }),
      );
      return jsonResponse(201, updated);
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
  expect(
    (screen.getByRole('combobox', { name: 'Visibility' }) as HTMLInputElement)
      .value,
  ).toBe('Public');
  await user.type(
    screen.getByRole('textbox', { name: 'Comment' }),
    'Administrator public note for Client.',
  );
  await user.click(screen.getByRole('button', { name: 'Add comment' }));

  const thread = await screen.findByLabelText('Comments');
  expect(
    within(thread).getByText('Administrator public note for Client.'),
  ).toBeDefined();
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
  mockTicketPatchSession({
    detail: sampleReopenedTicketDetail,
    user: alex,
    expectedStatus: 'in_progress',
    updated,
  });

  renderApp(['/tickets/ticket-3']);

  expect(
    await screen.findByRole('heading', {
      name: 'Reopened: returns portal blank page',
    }),
  ).toBeDefined();
  await chooseStatusTransition(user, /Mark as in progress/);

  expect(await screen.findByLabelText('Status: In progress')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Change status' })).toBeDefined();
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
  mockTicketPatchSession({
    detail: sampleTicketDetail,
    expectedStatus: 'in_progress',
    updated,
  });

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(screen.getByLabelText('Assignee: Unassigned')).toBeDefined();
  await chooseStatusTransition(user, /Mark as in progress/);
  expect(await screen.findByLabelText('Status: In progress')).toBeDefined();
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
  expect(screen.getByLabelText('Status: Resolved')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
});

test('failed Status Transition shows error copy without the raw server body', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketPatchSession({
    detail: sampleTicketDetail,
    patchResponse: jsonResponse(409, { message: 'Illegal edge stack' }),
  });

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  await chooseStatusTransition(user, /Mark as in progress/);

  expect(
    await screen.findByText("Couldn't update this ticket's status."),
  ).toBeDefined();
  expect(screen.queryByText('Illegal edge stack')).toBeNull();
  expect(screen.getByLabelText('Status: Open')).toBeDefined();
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
  expect(screen.getByLabelText('Status: Resolved')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
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
  expect(screen.getByLabelText('Status: Closed')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull();
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
  mockTicketPatchSession({
    detail: sampleResolvedTicketDetail,
    expectedStatus: 'closed',
    updated,
  });

  renderApp(['/tickets/ticket-gift-card']);

  expect(
    await screen.findByRole('heading', {
      name: 'Resolved: gift-card balance mismatch',
    }),
  ).toBeDefined();
  expect(screen.getByRole('button', { name: 'Change status' })).toBeDefined();
  await chooseStatusTransition(user, /Close/);

  expect(await screen.findByLabelText('Status: Closed')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Change status' })).toBeDefined();
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
  mockTicketPatchSession({
    detail: sampleClosedTicketDetail,
    expectedStatus: 'open',
    updated,
  });

  renderApp(['/tickets/ticket-invoice']);

  expect(
    await screen.findByRole('heading', {
      name: 'Closed: invoice PDF encoding',
    }),
  ).toBeDefined();
  expect(screen.getByRole('button', { name: 'Change status' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  await chooseStatusTransition(user, /Reopen/);

  expect(await screen.findByLabelText('Status: Open')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Change status' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
});
