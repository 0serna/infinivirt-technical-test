import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  alex,
  emptyTickets,
  isDashboardUrl,
  isUsersUrl,
  jsonResponse,
  mockAuthedSession,
  renderApp,
  sam,
  sampleUserCatalog,
} from '../test/render-app';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('Administrator sees Users nav link and Agent and Supervisor do not', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(emptyTickets, ada);

  const { unmount } = renderApp(['/dashboard']);
  expect(await screen.findByRole('link', { name: 'Users' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'Users' }).getAttribute('href')).toBe(
    '/admin/users',
  );
  expect(screen.getByRole('link', { name: 'Clients' })).toBeDefined();
  unmount();

  mockAuthedSession(emptyTickets, alex);
  const agent = renderApp(['/dashboard']);
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Clients' })).toBeNull();
  agent.unmount();

  mockAuthedSession(emptyTickets, sam);
  renderApp(['/dashboard']);
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Clients' })).toBeNull();
});

test('Administrator /admin/users lists Users and can create one via POST', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const users = [...sampleUserCatalog];

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
    if (isUsersUrl(url) && method === 'GET') {
      return jsonResponse(200, users);
    }
    if (url === '/api/users' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        email?: string;
        displayName?: string;
        role?: string;
        password?: string;
      };
      const created = {
        id: 'user-new',
        email: body.email ?? '',
        displayName: body.displayName ?? '',
        role: (body.role ?? 'agent') as 'agent' | 'supervisor' | 'admin',
      };
      users.push(created);
      return jsonResponse(201, created);
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  renderApp(['/admin/users']);

  expect(await screen.findByRole('heading', { name: 'Users' })).toBeDefined();
  const table = await screen.findByRole('table');
  expect(within(table).getByText('Ada Lovelace')).toBeDefined();
  expect(within(table).getByText('ada@example.com')).toBeDefined();
  expect(within(table).getByText('Alex Agent')).toBeDefined();

  await user.type(screen.getByLabelText('Email'), 'new.agent@example.com');
  await user.type(screen.getByLabelText('Display name'), 'New Agent');
  await user.type(screen.getByLabelText('Password'), 'InitialPass123!');
  await user.click(screen.getByRole('button', { name: 'Create User' }));

  expect(await within(table).findByText('New Agent')).toBeDefined();
  expect(within(table).getByText('new.agent@example.com')).toBeDefined();

  const postCall = vi
    .mocked(fetch)
    .mock.calls.find(
      ([url, init]) =>
        String(url) === '/api/users' &&
        (init?.method ?? 'GET').toUpperCase() === 'POST',
    );
  expect(postCall).toBeDefined();
  expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
    email: 'new.agent@example.com',
    displayName: 'New Agent',
    role: 'agent',
    password: 'InitialPass123!',
  });
});
