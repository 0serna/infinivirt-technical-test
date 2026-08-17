import { act, screen, within } from '@testing-library/react';
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

async function openCreateModal() {
  const user = userEvent.setup();
  renderApp(['/tickets']);
  await user.click(await screen.findByRole('button', { name: 'New ticket' }));
  return user;
}

function createDialog() {
  return within(screen.getByRole('dialog', { name: 'New ticket' }));
}

async function openClientSelect(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await createDialog().findByRole('combobox', { name: 'Client' }),
  );
}

function clientOption(name: string) {
  // Closed Ticket List filter Selects keep hidden options in the DOM; the
  // modal's Select mounts later in the portal, so the last match is ours.
  const matches = screen.getAllByRole('option', { name, hidden: true });
  return matches[matches.length - 1];
}

async function fillCreateFields(
  user: ReturnType<typeof userEvent.setup>,
  {
    client,
    title,
    description,
  }: { client: string; title: string; description: string },
) {
  const dialog = createDialog();
  await openClientSelect(user);
  await user.click(clientOption(client));
  await user.type(dialog.getByRole('textbox', { name: 'Title' }), title);
  await user.type(
    dialog.getByRole('textbox', { name: 'Description' }),
    description,
  );
}

function ticketPostCalls() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(
      ([url, init]) =>
        String(url) === '/api/tickets' &&
        (init?.method ?? 'GET').toUpperCase() === 'POST',
    );
}

test('Ticket List New ticket opens the create form without treating new as a Ticket id', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession();

  await openCreateModal();

  expect(
    await screen.findByRole('heading', { name: 'New ticket' }),
  ).toBeDefined();
  expect(screen.queryByText('Loading ticket…')).toBeNull();
  expect(screen.queryByText('Ticket not found.')).toBeNull();

  const detailCalls = vi
    .mocked(fetch)
    .mock.calls.filter(
      ([url, init]) =>
        isTicketDetailUrl(String(url)) &&
        (init?.method ?? 'GET').toUpperCase() === 'GET' &&
        String(url).endsWith('/new'),
    );
  expect(detailCalls).toEqual([]);
});

test('create form loads Clients from GET /api/clients not Ticket List filterOptions', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession();

  const user = await openCreateModal();

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

  await openCreateModal();

  const dialog = createDialog();
  expect(await dialog.findByRole('combobox', { name: 'Client' })).toBeDefined();
  expect(dialog.getByRole('textbox', { name: 'Title' })).toBeDefined();
  expect(dialog.getByRole('textbox', { name: 'Description' })).toBeDefined();
  expect(dialog.getByRole('combobox', { name: 'Priority' })).toBeDefined();
  expect(dialog.getByDisplayValue('Medium')).toBeDefined();
  expect(dialog.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
  expect(dialog.getByRole('button', { name: 'Create ticket' })).toBeDefined();
});

test('client-side validation blocks submit when Client, Title, or description is missing', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession();

  const user = await openCreateModal();

  expect(
    await createDialog().findByRole('button', { name: 'Create ticket' }),
  ).toBeDefined();
  await user.click(
    createDialog().getByRole('button', { name: 'Create ticket' }),
  );

  expect(
    await screen.findByText('Client, Title, and description are required.'),
  ).toBeDefined();
  expect(ticketPostCalls()).toEqual([]);

  await fillCreateFields(user, {
    client: 'Acme Logistics',
    title: '   ',
    description: 'Has a description.',
  });
  await user.click(
    createDialog().getByRole('button', { name: 'Create ticket' }),
  );

  expect(
    await screen.findByText('Client, Title, and description are required.'),
  ).toBeDefined();
  expect(ticketPostCalls()).toEqual([]);
});

test('successful create posts the Ticket and navigates to the new Ticket detail', async () => {
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

  const user = await openCreateModal();

  await fillCreateFields(user, {
    client: 'Acme Logistics',
    title: 'Printer offline at front desk',
    description: 'Receipt printer shows offline since this morning.',
  });
  await user.click(createDialog().getByRole('combobox', { name: 'Priority' }));
  await user.click(clientOption('High'));
  await user.click(
    createDialog().getByRole('button', { name: 'Create ticket' }),
  );

  expect(
    await screen.findByRole('heading', {
      name: 'Printer offline at front desk',
    }),
  ).toBeDefined();
  expect(screen.getByLabelText('Client: Acme Logistics')).toBeDefined();
});

test('submit is disabled while create is in flight', async () => {
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

  const user = await openCreateModal();

  await fillCreateFields(user, {
    client: 'Contoso Health',
    title: 'VPN dropouts',
    description: 'Intermittent VPN drops for warehouse staff.',
  });

  const submit = createDialog().getByRole('button', { name: 'Create ticket' });
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
  localStorage.setItem('accessToken', 'token-abc');
  mockCreateSession({
    onPost: () => jsonResponse(500, { message: 'Internal boom stack' }),
  });

  const user = await openCreateModal();

  await fillCreateFields(user, {
    client: 'Contoso Health',
    title: 'Should fail',
    description: 'Body that will not create.',
  });
  await user.click(
    createDialog().getByRole('button', { name: 'Create ticket' }),
  );

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
    if (isTicketsUrl(url)) {
      return jsonResponse(200, sampleTickets);
    }
    if (isClientsUrl(url)) {
      return jsonResponse(500, { message: 'Catalog boom stack' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  await openCreateModal();

  expect(await screen.findByText("Couldn't load clients.")).toBeDefined();
  expect(screen.queryByText('Catalog boom stack')).toBeNull();
});
