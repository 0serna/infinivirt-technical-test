import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  alex,
  emptyTickets,
  isClientsUrl,
  jsonResponse,
  mockAuthedSession,
  renderApp,
  sam,
  sampleClientCatalog,
} from '../test/render-app';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('Administrator sees Clients nav link and Agent and Supervisor do not', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(emptyTickets, ada);

  const { unmount } = renderApp(['/dashboard']);
  expect(await screen.findByRole('link', { name: 'Clients' })).toBeDefined();
  expect(
    screen.getByRole('link', { name: 'Clients' }).getAttribute('href'),
  ).toBe('/admin/clients');
  unmount();

  mockAuthedSession(emptyTickets, alex);
  const agent = renderApp(['/dashboard']);
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.queryByRole('link', { name: 'Clients' })).toBeNull();
  agent.unmount();

  mockAuthedSession(emptyTickets, sam);
  renderApp(['/dashboard']);
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.queryByRole('link', { name: 'Clients' })).toBeNull();
});

test('Administrator /admin/clients lists Clients and can create one via POST', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const clients = [...sampleClientCatalog];

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isClientsUrl(url) && method === 'GET') {
      return jsonResponse(200, clients);
    }
    if (url === '/api/clients' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { name?: string };
      const created = {
        id: 'client-new',
        name: body.name ?? '',
        deletedAt: null,
      };
      clients.push(created);
      return jsonResponse(201, created);
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  renderApp(['/admin/clients']);

  expect(await screen.findByRole('heading', { name: 'Clients' })).toBeDefined();
  const table = await screen.findByRole('table');
  expect(within(table).getByText('Contoso Health')).toBeDefined();
  expect(within(table).getByText('Acme Logistics')).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'New Client' }));
  await user.type(screen.getByLabelText('Name'), 'New Client Co');
  await user.click(screen.getByRole('button', { name: 'Create Client' }));

  expect(await within(table).findByText('New Client Co')).toBeDefined();

  const postCall = vi
    .mocked(fetch)
    .mock.calls.find(
      ([url, init]) =>
        String(url) === '/api/clients' &&
        (init?.method ?? 'GET').toUpperCase() === 'POST',
    );
  expect(postCall).toBeDefined();
  expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
    name: 'New Client Co',
  });

  const listCall = vi
    .mocked(fetch)
    .mock.calls.find(
      ([url, init]) =>
        isClientsUrl(String(url)) &&
        (init?.method ?? 'GET').toUpperCase() === 'GET',
    );
  expect(String(listCall?.[0])).toContain('includeDeleted=true');
});

test('Administrator can rename, soft-delete, and restore a Client', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const clients = [
    {
      id: 'client-1',
      name: 'Contoso Health',
      deletedAt: null as string | null,
    },
  ];

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isClientsUrl(url) && method === 'GET') {
      return jsonResponse(200, clients);
    }
    if (url === '/api/clients/client-1' && method === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { name?: string };
      clients[0] = {
        ...clients[0],
        name: body.name ?? clients[0].name,
      };
      return jsonResponse(200, clients[0]);
    }
    if (url === '/api/clients/client-1' && method === 'DELETE') {
      clients[0] = {
        ...clients[0],
        deletedAt: '2026-08-17T05:00:00.000Z',
      };
      return jsonResponse(200, clients[0]);
    }
    if (url === '/api/clients/client-1/restore' && method === 'POST') {
      clients[0] = { ...clients[0], deletedAt: null };
      return jsonResponse(201, clients[0]);
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  renderApp(['/admin/clients']);

  const table = await screen.findByRole('table');
  expect(within(table).getByText('Contoso Health')).toBeDefined();
  expect(within(table).getByText('Current')).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Rename' }));
  const renameInput = screen.getByLabelText('Rename Contoso Health');
  await user.clear(renameInput);
  await user.type(renameInput, 'Contoso Renamed');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(await within(table).findByText('Contoso Renamed')).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Soft-delete' }));
  expect(await within(table).findByText('Soft-deleted')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Restore' }));
  expect(await within(table).findByText('Current')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Rename' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Soft-delete' })).toBeDefined();
});

test('Agent and Supervisor visiting /admin/clients are redirected to the dashboard', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(emptyTickets, alex);
  const agent = renderApp(['/admin/clients'], { probeLocation: true });
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.getByTestId('location-path').textContent).toBe('/dashboard');
  agent.unmount();

  mockAuthedSession(emptyTickets, sam);
  renderApp(['/admin/clients'], { probeLocation: true });
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.getByTestId('location-path').textContent).toBe('/dashboard');
});

test('Administrator sees an error when Clients fail to load', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isClientsUrl(url)) {
      return jsonResponse(500, { message: 'fail' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/admin/clients']);
  expect(await screen.findByText("Couldn't load Clients.")).toBeDefined();
});

test('Administrator sees an error when Client create fails', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isClientsUrl(url) && method === 'GET') {
      return jsonResponse(200, sampleClientCatalog);
    }
    if (url === '/api/clients' && method === 'POST') {
      return jsonResponse(500, { message: 'fail' });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  renderApp(['/admin/clients']);
  expect(await screen.findByRole('heading', { name: 'Clients' })).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'New Client' }));
  await user.type(screen.getByLabelText('Name'), 'Broken Co');
  await user.click(screen.getByRole('button', { name: 'Create Client' }));
  expect(await screen.findByText("Couldn't create this Client.")).toBeDefined();
});
