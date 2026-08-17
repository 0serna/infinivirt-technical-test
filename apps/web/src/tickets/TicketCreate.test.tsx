import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  isClientsUrl,
  isTicketDetailUrl,
  isTicketsUrl,
  jsonResponse,
  renderApp,
  sampleClientCatalog,
  sampleTicketDetail,
  sampleTickets,
} from '../test/render-app';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function mockCreateSession({
  onPost,
  clients = sampleClientCatalog,
  detail = {
    ...sampleTicketDetail,
    id: 'ticket-new',
    title: 'Printer offline at front desk',
    description: 'Receipt printer shows offline since this morning.',
    priority: 'medium' as const,
    client: { id: 'client-acme', name: 'Acme Logistics' },
  },
}: {
  onPost?: (body: string) => Response | Promise<Response>;
  clients?: typeof sampleClientCatalog;
  detail?: unknown;
} = {}) {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketsUrl(url) && method === 'GET') {
      return jsonResponse(200, sampleTickets);
    }
    if (isClientsUrl(url) && method === 'GET') {
      return jsonResponse(200, clients);
    }
    if (url === '/api/tickets' && method === 'POST') {
      if (onPost) {
        return onPost(String(init?.body ?? ''));
      }
      return jsonResponse(201, detail);
    }
    if (isTicketDetailUrl(url) && method === 'GET') {
      return jsonResponse(200, detail);
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });
}

async function openClientSelect(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('combobox', { name: 'Client' }));
}

function clientOption(name: string) {
  return screen.getByRole('option', { name, hidden: true });
}

test('Ticket List New ticket opens the create form without treating new as a Ticket id', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession();

  renderApp(['/']);

  expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeDefined();
  await user.click(screen.getByRole('link', { name: 'New ticket' }));

  expect(
    await screen.findByRole('heading', { name: 'New ticket' }),
  ).toBeDefined();
  expect(screen.queryByText('Loading ticket…')).toBeNull();
  expect(screen.queryByText('Ticket not found.')).toBeNull();

  const detailCalls = vi
    .mocked(fetch)
    .mock.calls.filter(
      ([url, init]) =>
        String(url) === '/api/tickets/new' ||
        (isTicketDetailUrl(String(url)) &&
          (init?.method ?? 'GET').toUpperCase() === 'GET' &&
          String(url).endsWith('/new')),
    );
  expect(detailCalls).toEqual([]);
});

test('create form loads Clients from GET /api/clients not Ticket List filterOptions', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession({
    clients: sampleClientCatalog,
  });

  renderApp(['/tickets/new']);

  await openClientSelect(user);
  expect(clientOption('Acme Logistics')).toBeDefined();
  expect(clientOption('Contoso Health')).toBeDefined();
  expect(clientOption('Initech Soft')).toBeDefined();

  const clientsCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => isClientsUrl(String(url)));
  expect(clientsCall).toBeDefined();
  expect(new Headers(clientsCall?.[1]?.headers).get('Authorization')).toBe(
    'Bearer token-abc',
  );
});

test('create form shows Client, Title, description, and Priority defaulting to medium', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession();

  renderApp(['/tickets/new']);

  expect(await screen.findByRole('combobox', { name: 'Client' })).toBeDefined();
  expect(screen.getByRole('textbox', { name: 'Title' })).toBeDefined();
  expect(screen.getByRole('textbox', { name: 'Description' })).toBeDefined();
  expect(screen.getByRole('combobox', { name: 'Priority' })).toBeDefined();
  expect(screen.getByDisplayValue('Medium')).toBeDefined();
  expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Create ticket' })).toBeDefined();
});

test('client-side validation blocks submit when Client, Title, or description is missing', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession();

  renderApp(['/tickets/new']);

  expect(
    await screen.findByRole('button', { name: 'Create ticket' }),
  ).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Create ticket' }));

  expect(
    await screen.findByText('Client, Title, and description are required.'),
  ).toBeDefined();

  const postCalls = vi
    .mocked(fetch)
    .mock.calls.filter(
      ([url, init]) =>
        String(url) === '/api/tickets' &&
        (init?.method ?? 'GET').toUpperCase() === 'POST',
    );
  expect(postCalls).toEqual([]);

  await openClientSelect(user);
  await user.click(clientOption('Acme Logistics'));
  await user.type(screen.getByRole('textbox', { name: 'Title' }), '   ');
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'Has a description.',
  );
  await user.click(screen.getByRole('button', { name: 'Create ticket' }));

  expect(
    await screen.findByText('Client, Title, and description are required.'),
  ).toBeDefined();
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(
        ([url, init]) =>
          String(url) === '/api/tickets' &&
          (init?.method ?? 'GET').toUpperCase() === 'POST',
      ),
  ).toEqual([]);
});

test('successful create posts the Ticket and navigates to the new Ticket detail', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const created = {
    ...sampleTicketDetail,
    id: 'ticket-new',
    title: 'Printer offline at front desk',
    description: 'Receipt printer shows offline since this morning.',
    priority: 'high' as const,
    client: { id: 'client-acme', name: 'Acme Logistics' },
  };
  mockCreateSession({
    detail: created,
    onPost: (body) => {
      expect(body).toBe(
        JSON.stringify({
          clientId: 'client-acme',
          title: 'Printer offline at front desk',
          description: 'Receipt printer shows offline since this morning.',
          priority: 'high',
        }),
      );
      return jsonResponse(201, created);
    },
  });

  renderApp(['/tickets/new']);

  await openClientSelect(user);
  await user.click(clientOption('Acme Logistics'));
  await user.type(
    screen.getByRole('textbox', { name: 'Title' }),
    'Printer offline at front desk',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'Receipt printer shows offline since this morning.',
  );
  await user.click(screen.getByRole('combobox', { name: 'Priority' }));
  await user.click(screen.getByRole('option', { name: 'High', hidden: true }));
  await user.click(screen.getByRole('button', { name: 'Create ticket' }));

  expect(
    await screen.findByRole('heading', {
      name: 'Printer offline at front desk',
    }),
  ).toBeDefined();
  expect(screen.getByLabelText('Client: Acme Logistics')).toBeDefined();
});

test('submit is disabled while create is in flight', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  let resolvePost!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    resolvePost = resolve;
  });
  const created = {
    ...sampleTicketDetail,
    id: 'ticket-new',
    title: 'VPN dropouts',
    description: 'Intermittent VPN drops for warehouse staff.',
    priority: 'medium' as const,
    client: { id: 'client-1', name: 'Contoso Health' },
  };
  mockCreateSession({
    detail: created,
    onPost: () => pending,
  });

  renderApp(['/tickets/new']);

  await openClientSelect(user);
  await user.click(clientOption('Contoso Health'));
  await user.type(
    screen.getByRole('textbox', { name: 'Title' }),
    'VPN dropouts',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'Intermittent VPN drops for warehouse staff.',
  );

  const submit = screen.getByRole('button', { name: 'Create ticket' });
  await user.click(submit);

  expect((submit as HTMLButtonElement).disabled).toBe(true);

  await act(async () => {
    resolvePost(jsonResponse(201, created));
  });

  expect(
    await screen.findByRole('heading', { name: 'VPN dropouts' }),
  ).toBeDefined();
});

test('failed create shows English error copy without the raw server body', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession({
    onPost: () => jsonResponse(500, { message: 'Internal boom stack' }),
  });

  renderApp(['/tickets/new']);

  await openClientSelect(user);
  await user.click(clientOption('Contoso Health'));
  await user.type(
    screen.getByRole('textbox', { name: 'Title' }),
    'Should fail',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'Body that will not create.',
  );
  await user.click(screen.getByRole('button', { name: 'Create ticket' }));

  expect(await screen.findByText("Couldn't create this ticket.")).toBeDefined();
  expect(screen.queryByText('Internal boom stack')).toBeNull();
  expect(screen.getByRole('heading', { name: 'New ticket' })).toBeDefined();
});

test('failed Client catalog load shows error copy without the raw server body', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isClientsUrl(url)) {
      return jsonResponse(500, { message: 'Catalog boom stack' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/new']);

  expect(await screen.findByText("Couldn't load clients.")).toBeDefined();
  expect(screen.queryByText('Catalog boom stack')).toBeNull();
});
