import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from './auth/api';
import {
  ada,
  emptyTeamDashboard,
  emptyTickets,
  isDashboardUrl,
  isTicketsUrl,
  jsonResponse,
  mockAuthedSession,
  renderApp,
  unauthorized,
} from './test/render-app';

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

test('successful login shows the shell', async () => {
  const user = userEvent.setup();
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/login') {
      return jsonResponse(200, { accessToken: 'token-abc', user: ada });
    }
    if (isDashboardUrl(url)) {
      return jsonResponse(200, emptyTeamDashboard);
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
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
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
    if (isDashboardUrl(url)) {
      return jsonResponse(200, emptyTeamDashboard);
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

test('authenticated visit to /login is sent to the Dashboard at /dashboard', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession();

  renderApp(['/login']);

  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(screen.getByText('Ada Lovelace')).toBeDefined();
  expect(
    screen.getByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();
  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
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
    if (isDashboardUrl(url)) {
      return jsonResponse(200, emptyTeamDashboard);
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
