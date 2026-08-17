import type { AdminUserRow } from '@support-ticketing/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  alex,
  emptyTickets,
  isUsersUrl,
  jsonResponse,
  mockAuthedSession,
  renderApp,
  sam,
  sampleUserCatalog,
} from '../test/render-app';

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
        deletedAt: null,
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
  expect(within(table).getByText('Alex Turing')).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'New User' }));
  await user.type(screen.getByLabelText('Email'), 'new.agent@example.com');
  await user.type(screen.getByLabelText('Display name'), 'New Agent');
  await user.type(screen.getByLabelText('Password'), 'InitialPass123!');
  await user.click(screen.getByRole('button', { name: 'Create User' }));

  expect(await within(table).findByText('New Agent')).toBeDefined();
  expect(within(table).getByText('new.agent@example.com')).toBeDefined();

  const listCall = vi
    .mocked(fetch)
    .mock.calls.find(
      ([url, init]) =>
        isUsersUrl(String(url)) &&
        (init?.method ?? 'GET').toUpperCase() === 'GET',
    );
  expect(String(listCall?.[0])).toContain('includeDeleted=true');

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

test('Administrator can edit displayName/role and reset a User password', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const users: AdminUserRow[] = [
    {
      id: 'user-2',
      email: 'agent@example.com',
      displayName: 'Alex Turing',
      role: 'agent',
      deletedAt: null,
    },
  ];

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isUsersUrl(url) && method === 'GET') {
      return jsonResponse(200, users);
    }
    if (url === '/api/users/user-2' && method === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        displayName?: string;
        role?: 'agent' | 'supervisor' | 'admin';
      };
      users[0] = {
        ...users[0],
        displayName: body.displayName ?? users[0].displayName,
        role: body.role ?? users[0].role,
      };
      return jsonResponse(200, users[0]);
    }
    if (url === '/api/users/user-2/password' && method === 'PATCH') {
      return jsonResponse(200, users[0]);
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  renderApp(['/admin/users']);

  const table = await screen.findByRole('table');
  expect(within(table).getByText('Alex Turing')).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Edit' }));
  const displayNameInput = screen.getByLabelText(
    'Edit display name Alex Turing',
  );
  await user.clear(displayNameInput);
  await user.type(displayNameInput, 'Alex Renamed');
  await user.click(
    screen.getByRole('combobox', { name: 'Edit role Alex Turing' }),
  );
  const supervisorOptions = screen.getAllByRole('option', {
    name: 'Supervisor',
    hidden: true,
  });
  await user.click(supervisorOptions[supervisorOptions.length - 1]);
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(await within(table).findByText('Alex Renamed')).toBeDefined();
  expect(within(table).getByText('Supervisor')).toBeDefined();

  const patchCall = vi
    .mocked(fetch)
    .mock.calls.find(
      ([url, init]) =>
        String(url) === '/api/users/user-2' &&
        (init?.method ?? 'GET').toUpperCase() === 'PATCH',
    );
  expect(patchCall).toBeDefined();
  expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
    displayName: 'Alex Renamed',
    role: 'supervisor',
  });

  await user.click(screen.getByRole('button', { name: 'Reset password' }));
  await user.type(
    screen.getByLabelText('New password Alex Renamed'),
    'FreshPass123!',
  );
  await user.click(screen.getByRole('button', { name: 'Save password' }));

  const resetCall = vi
    .mocked(fetch)
    .mock.calls.find(
      ([url, init]) =>
        String(url) === '/api/users/user-2/password' &&
        (init?.method ?? 'GET').toUpperCase() === 'PATCH',
    );
  expect(resetCall).toBeDefined();
  expect(JSON.parse(String(resetCall?.[1]?.body))).toEqual({
    password: 'FreshPass123!',
  });
  expect(screen.queryByLabelText('New password Alex Renamed')).toBeNull();
});

test('Administrator can soft-delete and restore a User', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const users: AdminUserRow[] = [
    {
      id: 'user-2',
      email: 'agent@example.com',
      displayName: 'Alex Turing',
      role: 'agent',
      deletedAt: null,
    },
  ];

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isUsersUrl(url) && method === 'GET') {
      return jsonResponse(200, users);
    }
    if (url === '/api/users/user-2' && method === 'DELETE') {
      users[0] = {
        ...users[0],
        deletedAt: '2026-08-17T05:00:00.000Z',
      };
      return jsonResponse(200, users[0]);
    }
    if (url === '/api/users/user-2/restore' && method === 'POST') {
      users[0] = { ...users[0], deletedAt: null };
      return jsonResponse(201, users[0]);
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  renderApp(['/admin/users']);

  const table = await screen.findByRole('table');
  expect(within(table).getByText('Alex Turing')).toBeDefined();
  expect(within(table).getByText('Current')).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Soft-delete' }));
  expect(await within(table).findByText('Soft-deleted')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Restore' }));
  expect(await within(table).findByText('Current')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Soft-delete' })).toBeDefined();
});

test('Agent and Supervisor visiting /admin/users are redirected to the dashboard', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(emptyTickets, alex);
  const agent = renderApp(['/admin/users'], { probeLocation: true });
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.getByTestId('location-path').textContent).toBe('/dashboard');
  agent.unmount();

  mockAuthedSession(emptyTickets, sam);
  renderApp(['/admin/users'], { probeLocation: true });
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.getByTestId('location-path').textContent).toBe('/dashboard');
});

test('Administrator sees an error when Users fail to load', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isUsersUrl(url)) {
      return jsonResponse(500, { message: 'fail' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/admin/users']);
  expect(await screen.findByText("Couldn't load Users.")).toBeDefined();
});

test('edit conflict on a non-Administrator does not claim last-Administrator demote', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  const users: AdminUserRow[] = [
    {
      id: 'user-2',
      email: 'agent@example.com',
      displayName: 'Alex Turing',
      role: 'agent',
      deletedAt: null,
    },
  ];

  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isUsersUrl(url) && method === 'GET') {
      return jsonResponse(200, users);
    }
    if (url === '/api/users/user-2' && method === 'PATCH') {
      return jsonResponse(409, { statusCode: 409 });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  renderApp(['/admin/users']);
  expect(await screen.findByText('Alex Turing')).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Edit' }));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText("Couldn't update this User.")).toBeDefined();
  expect(
    screen.queryByText('Cannot demote the last Administrator.'),
  ).toBeNull();
});
