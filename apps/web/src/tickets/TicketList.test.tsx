import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  alex,
  emptyTickets,
  isTicketsUrl,
  jsonResponse,
  mockAuthedSession,
  renderApp,
  sam,
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

function filterControl(name: string) {
  return screen.getByRole('combobox', { name });
}

function filterOption(name: string) {
  return screen.getByRole('option', { name, hidden: true });
}

test('authenticated /tickets serves the Ticket List', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/tickets']);

  expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeDefined();
  expect(
    await screen.findByText('High: patient portal MFA reset'),
  ).toBeDefined();
  expect(screen.queryByText(/You are signed in as/)).toBeNull();
});

test('Ticket List rows render Title, Status, Priority, Client, Assignee, creator, and updatedAt', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/tickets']);

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
  expect(within(table).getByText('Sam Hopper')).toBeDefined();
  expect(within(table).getAllByText('Alex Turing').length).toBeGreaterThan(0);
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

  renderApp(['/tickets']);

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

  renderApp(['/tickets']);

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

  renderApp(['/tickets']);

  expect(await screen.findByText("Couldn't load tickets.")).toBeDefined();
  expect(screen.queryByText('Internal boom stack')).toBeNull();
});

test('failed first Ticket List load can be retried without a page reload', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  let ticketCalls = 0;
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketsUrl(url)) {
      ticketCalls += 1;
      if (ticketCalls === 1) {
        return jsonResponse(500, { message: 'Internal boom stack' });
      }
      return jsonResponse(200, sampleTickets);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets']);

  expect(await screen.findByText("Couldn't load tickets.")).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Try again' }));

  expect(
    await screen.findByText('High: patient portal MFA reset'),
  ).toBeDefined();
  expect(screen.queryByText("Couldn't load tickets.")).toBeNull();
  expect(ticketCalls).toBe(2);
});

test('Ticket List uses /api/tickets with the session Bearer token', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/tickets']);

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

  renderApp(['/tickets']);

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(
    await screen.findByText('Your session expired. Sign in again.'),
  ).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});

test('Agent Ticket List has Status, Priority, and Client filters and no Assignee filter', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets, alex);

  renderApp(['/tickets']);

  expect(await screen.findByRole('combobox', { name: 'Status' })).toBeDefined();
  expect(filterControl('Priority')).toBeDefined();
  expect(filterControl('Client')).toBeDefined();
  expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
});

test('Supervisor Ticket List has an Assignee filter including unassigned from filterOptions', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets, sam);

  renderApp(['/tickets']);

  await user.click(await screen.findByRole('combobox', { name: 'Assignee' }));
  expect(filterOption('Unassigned')).toBeDefined();
  expect(filterOption('Sam Hopper')).toBeDefined();
});

test('Administrator Ticket List has an Assignee filter including unassigned from filterOptions', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/tickets']);

  await user.click(await screen.findByRole('combobox', { name: 'Assignee' }));
  expect(filterOption('Unassigned')).toBeDefined();
  expect(filterOption('Sam Hopper')).toBeDefined();
});

test('Ticket List filter choices come from filterOptions and do not list Client or User catalogs', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession({
    ...sampleTickets,
    filterOptions: {
      clients: [{ id: 'client-1', name: 'Contoso Health' }],
      assignees: [],
      includeUnassigned: true,
    },
  });

  renderApp(['/tickets']);

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

  renderApp(['/tickets']);

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

test('Ticket List Titles link to the Ticket consult route', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(sampleTickets);

  renderApp(['/tickets']);

  const title = await screen.findByRole('link', {
    name: 'High: patient portal MFA reset',
  });
  expect(title.getAttribute('href')).toBe('/tickets/ticket-1');
  expect(
    screen
      .getByRole('link', { name: 'Resolved: SSO redirect loop' })
      .getAttribute('href'),
  ).toBe('/tickets/ticket-2');
});

test('opening /tickets with filter search params applies them in the UI and list request', async () => {
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

  renderApp([
    '/tickets?status=open&priority=high&clientId=client-1&assigneeId=user-3',
  ]);

  expect(
    await screen.findByRole('combobox', { name: 'Status' }),
  ).toHaveProperty('value', 'Open');
  expect(filterControl('Priority')).toHaveProperty('value', 'High');
  expect(filterControl('Client')).toHaveProperty('value', 'Contoso Health');
  expect(filterControl('Assignee')).toHaveProperty('value', 'Sam Hopper');

  const ticketUrls = vi
    .mocked(fetch)
    .mock.calls.map(([url]) => String(url))
    .filter((url) => isTicketsUrl(url));
  expect(ticketUrls).toContain(
    '/api/tickets?status=open&priority=high&clientId=client-1&assigneeId=user-3',
  );
});

test('changing Ticket List filters updates the URL search params', async () => {
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

  renderApp(['/tickets'], { probeLocation: true });

  await user.click(await screen.findByRole('combobox', { name: 'Status' }));
  await user.click(filterOption('Open'));
  await user.click(filterControl('Priority'));
  await user.click(filterOption('High'));
  await user.click(filterControl('Client'));
  await user.click(filterOption('Contoso Health'));
  await user.click(filterControl('Assignee'));
  await user.click(filterOption('Sam Hopper'));

  expect(await screen.findByTestId('location-path')).toHaveProperty(
    'textContent',
    '/tickets?status=open&priority=high&clientId=client-1&assigneeId=user-3',
  );
});

test('opening /tickets with Active Tickets, Stale, and assigned-open params drives the list request', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, alex);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets?status=open%2Cin_progress&stale=1&scope=assignedOpen']);

  expect(
    await screen.findByRole('combobox', { name: 'Status' }),
  ).toHaveProperty('value', 'Active Tickets');
  expect(screen.queryByRole('combobox', { name: 'Stale' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'Scope' })).toBeNull();

  const ticketUrls = vi
    .mocked(fetch)
    .mock.calls.map(([url]) => String(url))
    .filter((url) => isTicketsUrl(url));
  expect(ticketUrls).toContain(
    '/api/tickets?status=open%2Cin_progress&stale=1&scope=assignedOpen',
  );
});

test('choosing Active Tickets updates the URL and list request', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, alex);
    }
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets'], { probeLocation: true });

  await user.click(await screen.findByRole('combobox', { name: 'Status' }));
  await user.click(filterOption('Active Tickets'));

  expect(await screen.findByTestId('location-path')).toHaveProperty(
    'textContent',
    '/tickets?status=open%2Cin_progress',
  );

  const ticketUrls = vi
    .mocked(fetch)
    .mock.calls.map(([url]) => String(url))
    .filter((url) => isTicketsUrl(url));
  expect(ticketUrls).toContain('/api/tickets?status=open%2Cin_progress');
});
