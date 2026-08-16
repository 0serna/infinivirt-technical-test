import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, type InitialEntry } from 'react-router-dom';
import { App } from './App';
import { apiFetch } from './auth/api';

function renderApp(initialEntries: InitialEntry[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const unauthorized = jsonResponse(401, {
  statusCode: 401,
  message: 'Unauthorized',
});

const emptyTickets = {
  tickets: [],
  filterOptions: { clients: [], assignees: [] },
};

const sampleFilterOptions = {
  clients: [
    { id: 'client-1', name: 'Contoso Health' },
    { id: 'client-2', name: 'Initech Soft' },
  ],
  assignees: [
    { id: 'user-3', displayName: 'Sam Supervisor' },
    { id: 'unassigned', displayName: 'Unassigned' },
  ],
};

const sampleTickets = {
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

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('empty login shows required-field copy without calling the API', async () => {
  const user = userEvent.setup();
  renderApp(['/login']);

  expect(screen.getByLabelText('Email')).toHaveProperty('type', 'email');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(screen.getByText('Email and password are required.')).toBeDefined();
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
});

test('opaque login 401 shows Sign in failed without echoing the server body', async () => {
  const user = userEvent.setup();
  vi.mocked(fetch).mockResolvedValue(unauthorized);

  renderApp(['/login']);

  await user.type(screen.getByLabelText('Email'), 'agent@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Sign in failed.')).toBeDefined();
  expect(screen.queryByText('Unauthorized')).toBeNull();
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('/api/auth/login');
  expect(init?.method).toBe('POST');
  expect(JSON.parse(String(init?.body))).toEqual({
    email: 'agent@example.com',
    password: 'secret',
  });
});

test('login network failure shows server unreachable copy', async () => {
  const user = userEvent.setup();
  vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

  renderApp(['/login']);

  await user.type(screen.getByLabelText('Email'), 'agent@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(
    await screen.findByText("Can't reach the server. Try again."),
  ).toBeDefined();
});

const ada = {
  id: 'user-1',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  role: 'admin' as const,
};

const alex = {
  id: 'user-2',
  email: 'agent@example.com',
  displayName: 'Alex Agent',
  role: 'agent' as const,
};

const sam = {
  id: 'user-3',
  email: 'supervisor@example.com',
  displayName: 'Sam Supervisor',
  role: 'supervisor' as const,
};

function isTicketsUrl(url: string): boolean {
  return url === '/api/tickets' || url.startsWith('/api/tickets?');
}

function filterControl(name: string) {
  return screen.getByRole('combobox', { name });
}

function filterOption(name: string) {
  return screen.getByRole('option', { name, hidden: true });
}

function mockAuthedSession(
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

test('successful login shows the shell', async () => {
  const user = userEvent.setup();
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/login') {
      return jsonResponse(200, { accessToken: 'token-abc', user: ada });
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, emptyTickets);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/login']);

  await user.type(screen.getByLabelText('Email'), ada.email);
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(
    await screen.findByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();
  expect(screen.getByText('Ada Lovelace')).toBeDefined();
  expect(screen.getByText('Administrator')).toBeDefined();
  expect(screen.queryByText(/API health/)).toBeNull();
  expect(localStorage.getItem('accessToken')).toBe('token-abc');
});

test('bootstrap with a valid token hydrates the shell from /api/auth/me', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession();

  renderApp(['/']);

  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(await screen.findByText('Ada Lovelace')).toBeDefined();
  expect(screen.getByText('Administrator')).toBeDefined();
  expect(
    screen.getByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();

  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('/api/auth/me');
  expect(init?.method ?? 'GET').toBe('GET');
  expect(new Headers(init?.headers).get('Authorization')).toBe(
    'Bearer token-abc',
  );
});

test('bootstrap 401 clears the token and shows login without an expiry message', async () => {
  localStorage.setItem('accessToken', 'dead-token');
  vi.mocked(fetch).mockResolvedValue(unauthorized);

  renderApp(['/']);

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(screen.queryByText('Your session expired. Sign in again.')).toBeNull();
  expect(screen.queryByText('Unauthorized')).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();

  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('/api/auth/me');
  expect(new Headers(init?.headers).get('Authorization')).toBe(
    'Bearer dead-token',
  );
});

test('sign out returns to login and later requests do not send Bearer', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, emptyTickets);
    }
    if (url === '/api/auth/login') {
      return unauthorized;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/']);

  await user.click(await screen.findByRole('button', { name: 'Sign out' }));

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();

  vi.mocked(fetch).mockClear();
  await user.type(screen.getByLabelText('Email'), ada.email);
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Sign in failed.')).toBeDefined();
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('/api/auth/login');
  expect(new Headers(init?.headers).get('Authorization')).toBeNull();
});

test('authenticated visit to /login is sent to the shell at /', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession();

  renderApp(['/login']);

  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(screen.getByText('Ada Lovelace')).toBeDefined();
  expect(
    screen.getByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();
});

test('unauthenticated visit to / is sent to login without showing the shell', async () => {
  renderApp(['/']);

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(
    screen.queryByRole('heading', { name: 'Support Ticketing' }),
  ).toBeNull();
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
});

test('mid-session 401 shows the session expired alert on login', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  let meCalls = 0;
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      meCalls += 1;
      return meCalls === 1 ? jsonResponse(200, ada) : unauthorized;
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, emptyTickets);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/']);
  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeDefined();

  await act(async () => {
    await apiFetch('/api/auth/me');
  });

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(
    await screen.findByText('Your session expired. Sign in again.'),
  ).toBeDefined();
  expect(screen.queryByText('Unauthorized')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});

test('reload of login ignores leftover sessionExpired history state', () => {
  renderApp([{ pathname: '/login', state: { sessionExpired: true } }]);

  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByText('Your session expired. Sign in again.')).toBeNull();
});

test('signed-in home shows the Ticket List instead of the old placeholder', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/']);

  expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeDefined();
  expect(screen.getByText('High: patient portal MFA reset')).toBeDefined();
  expect(screen.queryByText(/You are signed in as/)).toBeNull();
});

test('Ticket List rows render Title, Status, Priority, Client, Assignee, creator, and updatedAt', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/']);

  expect(
    await screen.findByText('High: patient portal MFA reset'),
  ).toBeDefined();
  const table = screen.getByRole('table');
  expect(within(table).getByText('Open')).toBeDefined();
  expect(within(table).getByText('High')).toBeDefined();
  expect(within(table).getByText('Contoso Health')).toBeDefined();
  expect(within(table).getByText('Unassigned')).toBeDefined();
  expect(within(table).getByText('Resolved: SSO redirect loop')).toBeDefined();
  expect(within(table).getByText('Resolved')).toBeDefined();
  expect(within(table).getByText('Low')).toBeDefined();
  expect(within(table).getByText('Initech Soft')).toBeDefined();
  expect(within(table).getByText('Sam Supervisor')).toBeDefined();
  expect(within(table).getAllByText('Alex Agent').length).toBeGreaterThan(0);
  expect(screen.getByText('1 Aug 2026, 12:00')).toBeDefined();
  expect(screen.getByText('30 Jul 2026, 09:15')).toBeDefined();
  expect(screen.getByRole('columnheader', { name: 'Title' })).toBeDefined();
  expect(screen.getByRole('columnheader', { name: 'Status' })).toBeDefined();
  expect(screen.getByRole('columnheader', { name: 'Priority' })).toBeDefined();
  expect(screen.getByRole('columnheader', { name: 'Client' })).toBeDefined();
  expect(screen.getByRole('columnheader', { name: 'Assignee' })).toBeDefined();
  expect(
    screen.getByRole('columnheader', { name: 'Created by' }),
  ).toBeDefined();
  expect(screen.getByRole('columnheader', { name: 'Updated' })).toBeDefined();
});

test('empty Ticket List shows an empty state', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(emptyTickets);

  renderApp(['/']);

  expect(await screen.findByText('No tickets to show.')).toBeDefined();
  expect(screen.queryByRole('columnheader', { name: 'Title' })).toBeNull();
});

test('in-flight Ticket List shows loading before rows', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  let resolveTickets!: (value: Response) => void;
  const ticketsPending = new Promise<Response>((resolve) => {
    resolveTickets = resolve;
  });
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketsUrl(url)) {
      return ticketsPending;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/']);

  expect(await screen.findByText('Loading tickets…')).toBeDefined();
  expect(screen.queryByText('No tickets to show.')).toBeNull();
  expect(screen.queryByText('High: patient portal MFA reset')).toBeNull();

  await act(async () => {
    resolveTickets(jsonResponse(200, sampleTickets));
  });

  expect(
    await screen.findByText('High: patient portal MFA reset'),
  ).toBeDefined();
  expect(screen.queryByText('Loading tickets…')).toBeNull();
});

test('failed Ticket List fetch shows error copy without the raw server body', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(500, { message: 'Internal boom stack' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/']);

  expect(
    await screen.findByText("Couldn't load tickets. Try again."),
  ).toBeDefined();
  expect(screen.queryByText('Internal boom stack')).toBeNull();
});

test('Ticket List uses /api/tickets with the session Bearer token', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/']);

  expect(
    await screen.findByText('High: patient portal MFA reset'),
  ).toBeDefined();
  const ticketsCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => url === '/api/tickets');
  expect(ticketsCall).toBeDefined();
  expect(new Headers(ticketsCall?.[1]?.headers).get('Authorization')).toBe(
    'Bearer token-abc',
  );
});

test('Ticket List 401 signs the User out', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketsUrl(url)) {
      return unauthorized;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/']);

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(
    await screen.findByText('Your session expired. Sign in again.'),
  ).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});

test('clearing the token from another tab leaves the shell', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession();

  renderApp(['/']);

  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeDefined();

  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'accessToken',
        oldValue: 'token-abc',
        newValue: null,
      }),
    );
  });

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(screen.queryByText('Your session expired. Sign in again.')).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});

test('Agent Ticket List has Status, Priority, and Client filters and no Assignee filter', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets, alex);

  renderApp(['/']);

  expect(await screen.findByRole('combobox', { name: 'Status' })).toBeDefined();
  expect(filterControl('Priority')).toBeDefined();
  expect(filterControl('Client')).toBeDefined();
  expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
});

test('Supervisor Ticket List has an Assignee filter including unassigned from filterOptions', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets, sam);

  renderApp(['/']);

  await user.click(await screen.findByRole('combobox', { name: 'Assignee' }));
  expect(filterOption('Unassigned')).toBeDefined();
  expect(filterOption('Sam Supervisor')).toBeDefined();
});

test('Administrator Ticket List has an Assignee filter including unassigned from filterOptions', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/']);

  await user.click(await screen.findByRole('combobox', { name: 'Assignee' }));
  expect(filterOption('Unassigned')).toBeDefined();
  expect(filterOption('Sam Supervisor')).toBeDefined();
});

test('Ticket List filter choices come from filterOptions and do not list Client or User catalogs', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession({
    ...sampleTickets,
    filterOptions: {
      clients: [{ id: 'client-1', name: 'Contoso Health' }],
      assignees: [{ id: 'unassigned', displayName: 'Unassigned' }],
    },
  });

  renderApp(['/']);

  await user.click(await screen.findByRole('combobox', { name: 'Client' }));
  expect(filterOption('Contoso Health')).toBeDefined();
  expect(
    screen.queryByRole('option', { name: 'Acme Logistics', hidden: true }),
  ).toBeNull();
  expect(
    screen.queryByRole('option', { name: 'Initech Soft', hidden: true }),
  ).toBeNull();

  const catalogCalls = vi
    .mocked(fetch)
    .mock.calls.filter(([url]) =>
      ['/api/clients', '/api/users'].includes(String(url)),
    );
  expect(catalogCalls).toEqual([]);
});

test('choosing Status and Client refetches tickets with those query params', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/']);

  await user.click(await screen.findByRole('combobox', { name: 'Status' }));
  await user.click(filterOption('Open'));
  await user.click(filterControl('Client'));
  await user.click(filterOption('Contoso Health'));

  const ticketUrls = vi
    .mocked(fetch)
    .mock.calls.map(([url]) => String(url))
    .filter((url) => isTicketsUrl(url));
  expect(ticketUrls).toContain('/api/tickets?status=open&clientId=client-1');
});
