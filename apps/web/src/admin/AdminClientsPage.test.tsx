import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  alex,
  emptyTickets,
  isClientsUrl,
  isDashboardUrl,
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
    if (isDashboardUrl(url)) {
      return jsonResponse(200, {
        kind: 'team',
        openTotal: 0,
        openByStatus: { open: 0, in_progress: 0 },
        staleCount: 0,
        stale: [],
      });
    }
    if (isClientsUrl(url) && method === 'GET') {
      return jsonResponse(200, clients);
    }
    if (url === '/api/clients' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { name?: string };
      const created = { id: 'client-new', name: body.name ?? '' };
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
});
